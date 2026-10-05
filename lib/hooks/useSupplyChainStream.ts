'use client';

import { useState, useEffect, useCallback } from 'react';
import { Truck, AgentEvent, ArbitrageOpportunity } from '../types';
import { fetchRoute } from '../utils/routing';

// Define multiple realistic routes across India
const ROUTES = [
  {
    id: 'TRK-402',
    driver: 'Priya Sharma',
    start: [73.8567, 18.5204] as [number, number], // Pune
    end: [72.8777, 19.0760] as [number, number],   // Mumbai
    cargoValue: 120000,
    velocity: 68
  },
  {
    id: 'TRK-301',
    driver: 'Rajesh Kumar',
    start: [77.5946, 12.9716] as [number, number], // Bangalore
    end: [77.2090, 28.6139] as [number, number],   // Delhi
    cargoValue: 85000,
    velocity: 72
  },
  {
    id: 'TRK-205',
    driver: 'Anita Desai',
    start: [72.8777, 19.0760] as [number, number], // Mumbai
    end: [88.3639, 22.5726] as [number, number],   // Kolkata
    cargoValue: 95000,
    velocity: 70
  }
];

const createTruck = (
  id: string,
  driver: string,
  cargoValue: number,
  velocity: number,
  route: [number, number][],
  status: 'on-time' | 'delayed' | 'critical' | 'resolved' = 'on-time'
): Truck => ({
  id,
  cargoValue,
  velocity,
  status,
  position: route[0] || [0, 0],
  destination: route[route.length - 1] || [0, 0],
  route: route,
  driver
});

const events: Array<{ time: number; action: (trucks: Truck[]) => Partial<{ trucks: Truck[]; events: AgentEvent[]; arbitrage: ArbitrageOpportunity | null }> }> = [
  {
    time: 2000,
    action: () => ({ events: [{ id: `evt-${Date.now()}`, timestamp: new Date(), type: 'sensor', message: 'GPS sensors operational', severity: 'info' }] })
  },
  {
    time: 5000,
    action: (trucks) => ({
      trucks: trucks.map(t => t.id === 'TRK-402' ? { ...t, velocity: 0, status: 'delayed' as const } : t),
      events: [{ id: `evt-${Date.now()}`, timestamp: new Date(), type: 'alert', message: 'TRK-402 velocity dropped to 0 km/h', severity: 'warning' }]
    })
  },
  {
    time: 8000,
    action: (trucks) => ({
      trucks: trucks.map(t => t.id === 'TRK-402' ? { ...t, velocity: 0, status: 'critical' as const } : t),
      events: [{ id: `evt-${Date.now()}`, timestamp: new Date(), type: 'alert', message: 'TRK-402 CRITICAL - SLA threshold exceeded', severity: 'critical' }]
    })
  },
  {
    time: 12000,
    action: () => ({
      arbitrage: { truckId: 'TRK-402', projectedPenalty: 2500, solutionType: 'Relief Truck via Spot Market', solutionCost: 800, netSavings: 1700, details: 'Deploy backup truck - ETA 45 min' },
      events: [{ id: `evt-${Date.now()}`, timestamp: new Date(), type: 'arbitrage', message: '💎 ARBITRAGE OPPORTUNITY - Net Savings: $1,700', severity: 'critical' }]
    })
  }
];

export function useSupplyChainStream() {
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [eventsLog, setEventsLog] = useState<AgentEvent[]>([{ id: 'init', timestamp: new Date(), type: 'system', message: '🚀 Agent initialized', severity: 'info' }]);
  const [arbitrage, setArbitrage] = useState<ArbitrageOpportunity | null>(null);
  const [routeLoaded, setRouteLoaded] = useState(false);

  // Fetch real routes from OSRM on mount
  useEffect(() => {
    const loadRoutes = async () => {
      try {
        const loadedTrucks: Truck[] = [];
        
        // Load routes for all trucks
        for (const routeConfig of ROUTES) {
          try {
            const routeData = await fetchRoute(routeConfig.start, routeConfig.end);
            
            if (routeData && routeData.coordinates && routeData.coordinates.length > 0) {
              const truck = createTruck(
                routeConfig.id,
                routeConfig.driver,
                routeConfig.cargoValue,
                routeConfig.velocity,
                routeData.coordinates
              );
              loadedTrucks.push(truck);
              
              setEventsLog(prev => [{
                id: `evt-route-${routeConfig.id}-${Date.now()}`,
                timestamp: new Date(),
                type: 'system',
                message: ` ${routeConfig.id} route loaded (${routeData.coordinates.length} waypoints)`,
                severity: 'info'
              }, ...prev]);
            } else {
              // Fallback to simple 2-point route
              const fallbackRoute: [number, number][] = [routeConfig.start, routeConfig.end];
              const truck = createTruck(
                routeConfig.id,
                routeConfig.driver,
                routeConfig.cargoValue,
                routeConfig.velocity,
                fallbackRoute
              );
              loadedTrucks.push(truck);
            }
          } catch (error) {
            console.error(`Error loading route for ${routeConfig.id}:`, error);
            // Add truck with fallback route
            const fallbackRoute: [number, number][] = [routeConfig.start, routeConfig.end];
            const truck = createTruck(
              routeConfig.id,
              routeConfig.driver,
              routeConfig.cargoValue,
              routeConfig.velocity,
              fallbackRoute
            );
            loadedTrucks.push(truck);
          }
          
          // Add small delay between requests to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        setTrucks(loadedTrucks);
        setEventsLog(prev => [{
          id: `evt-all-routes-${Date.now()}`,
          timestamp: new Date(),
          type: 'system',
          message: ` ${loadedTrucks.length} trucks initialized with real routes`,
          severity: 'info'
        }, ...prev]);
        setRouteLoaded(true);
      } catch (error) {
        console.error('Error loading routes:', error);
        // Create fallback trucks
        const fallbackTrucks = ROUTES.map(config => 
          createTruck(
            config.id,
            config.driver,
            config.cargoValue,
            config.velocity,
            [config.start, config.end]
          )
        );
        setTrucks(fallbackTrucks);
        setRouteLoaded(true);
      }
    };

    loadRoutes();
  }, []);

  // Setup simulation events only after route is loaded
  useEffect(() => {
    if (!routeLoaded) return;

    const timers: NodeJS.Timeout[] = [];
    
    events.forEach(({ time, action }) => {
      const timer = setTimeout(() => {
        setTrucks(current => {
          const result = action(current);
          if (result.events) setEventsLog(prev => [...result.events!, ...prev]);
          if (result.arbitrage !== undefined) setArbitrage(result.arbitrage);
          return result.trucks || current;
        });
      }, time);
      timers.push(timer);
    });

    return () => timers.forEach(t => clearTimeout(t));
  }, [routeLoaded]);

  const executeArbitrage = useCallback(() => {
    setEventsLog(prev => [{ id: `evt-${Date.now()}`, timestamp: new Date(), type: 'system', message: '✅ Solution executed - Relief truck dispatched', severity: 'info' }, ...prev]);
    setTimeout(() => {
      setTrucks(prev => prev.map(t => t.id === arbitrage?.truckId ? { ...t, velocity: 65, status: 'resolved' as const } : t));
      setArbitrage(null);
    }, 2000);
  }, [arbitrage]);

  const dismissArbitrage = useCallback(() => {
    setArbitrage(null);
    setEventsLog(prev => [{ id: `evt-${Date.now()}`, timestamp: new Date(), type: 'system', message: 'Arbitrage opportunity dismissed', severity: 'info' }, ...prev]);
  }, []);

  return { trucks, events: eventsLog, arbitrageOpportunity: arbitrage, executeArbitrage, dismissArbitrage };
}
