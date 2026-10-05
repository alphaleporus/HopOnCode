'use client';

import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import { Truck } from '@/lib/types';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Center of India for better initial view
const INDIA_CENTER: [number, number] = [20.5937, 78.9629];

interface SupplyChainMapProps {
  trucks: Truck[];
  ecoMode: boolean;
}

// Component to handle map bounds based on trucks (only on initial load)
function MapBoundsHandler({ trucks }: { trucks: Truck[] }) {
  const map = useMap();
  const hasSetBoundsRef = useRef(false);
  
  useEffect(() => {
    // Only set bounds once when trucks first load
    if (trucks.length === 0 || hasSetBoundsRef.current) return;
    
    // Calculate bounds from all truck positions and routes
    const allPoints: [number, number][] = [];
    trucks.forEach(truck => {
      allPoints.push([truck.position[1], truck.position[0]]);
      if (truck.route && truck.route.length > 0) {
        truck.route.forEach(point => {
          allPoints.push([point[1], point[0]]);
        });
      }
    });
    
    if (allPoints.length > 0) {
      const bounds = L.latLngBounds(allPoints);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 8 });
      hasSetBoundsRef.current = true;
    }
  }, [trucks.length, map]); // Only depend on trucks.length, not the entire trucks array
  
  return null;
}

// Custom centering button component (stable, no re-renders)
function CenterButton({ trucks }: { trucks: Truck[] }) {
  const map = useMap();
  const buttonCreatedRef = useRef(false);
  
  useEffect(() => {
    // Only create button once
    if (buttonCreatedRef.current) return;
    
    const checkZoomControl = setInterval(() => {
      const zoomControl = document.querySelector('.leaflet-control-zoom');
      if (zoomControl && !buttonCreatedRef.current) {
        clearInterval(checkZoomControl);
        buttonCreatedRef.current = true;
        
        // Create center button
        const button = L.DomUtil.create('a', 'leaflet-control-center', zoomControl as HTMLElement);
        button.href = '#';
        button.title = 'Center on trucks';
        button.setAttribute('role', 'button');
        button.setAttribute('aria-label', 'Center map on trucks');
        button.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="22" y1="12" x2="18" y2="12"/>
            <line x1="6" y1="12" x2="2" y2="12"/>
            <line x1="12" y1="6" x2="12" y2="2"/>
            <line x1="12" y1="22" x2="12" y2="18"/>
          </svg>
        `;
        
        L.DomEvent.disableClickPropagation(button);
        L.DomEvent.on(button, 'click', function(e: Event) {
          e.preventDefault();
          
          // Get current trucks from the DOM or parent
          const currentTrucks = trucks;
          
          if (currentTrucks.length === 0) {
            map.setView(INDIA_CENTER, 5);
            return;
          }
          
          const allPoints: [number, number][] = [];
          currentTrucks.forEach(truck => {
            allPoints.push([truck.position[1], truck.position[0]]);
            if (truck.route && truck.route.length > 0) {
              truck.route.forEach(point => {
                allPoints.push([point[1], point[0]]);
              });
            }
          });
          
          if (allPoints.length > 0) {
            const bounds = L.latLngBounds(allPoints);
            map.fitBounds(bounds, { 
              padding: [50, 50], 
              maxZoom: 8,
              animate: true,
              duration: 0.5
            });
          }
        });
      }
    }, 100);
    
    return () => {
      clearInterval(checkZoomControl);
      const button = document.querySelector('.leaflet-control-center');
      if (button) {
        button.remove();
      }
    };
  }, [map, trucks]);
  
  return null;
}

// Custom truck icon
const createTruckIcon = (status: string) => {
  const color = status === 'signal-lost' ? '#64748b' :
                status === 'resolved' ? '#a855f7' : 
                status === 'on-time' ? '#10b981' : 
                status === 'delayed' ? '#f59e0b' : 
                status === 'critical' ? '#ef4444' : '#10b981';
  return L.divIcon({
    className: 'custom-truck-icon',
    html: `
      <div style="
        background: ${color};
        border: 2px solid white;
        border-radius: 50%;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 0 15px ${color}90;
        transition: all 0.3s ease;
      ">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2">
          <path d="M10 17h4V5H2v12h3m5 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm9 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0-9V2l3 3-3 3Z"/>
        </svg>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
};

export default function SupplyChainMap({ trucks, ecoMode }: SupplyChainMapProps) {
  // Define world bounds to prevent infinite scrolling
  const worldBounds: L.LatLngBoundsExpression = [
    [-85, -180], // Southwest coordinates
    [85, 180]    // Northeast coordinates
  ];

  return (
    <div className="w-full h-full relative">
      <MapContainer
        center={INDIA_CENTER}
        zoom={5}
        minZoom={3}
        maxZoom={18}
        maxBounds={worldBounds}
        maxBoundsViscosity={1.0}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
        worldCopyJump={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          noWrap={true}
        />

        <MapBoundsHandler trucks={trucks} />
        <CenterButton trucks={trucks} />

        {trucks.map((truck) => (
          <React.Fragment key={truck.id}>
            {/* Route polyline */}
            {truck.route && truck.route.length > 0 && (
              <Polyline
                positions={truck.route.map(coord => [coord[1], coord[0]])}
                pathOptions={{
                  color: truck.status === 'signal-lost' ? '#64748b' :
                         truck.status === 'resolved' ? '#a855f7' :
                         truck.status === 'critical' ? '#ef4444' : 
                         truck.status === 'delayed' ? '#f59e0b' : '#10b981',
                  weight: 4,
                  opacity: 0.8,
                  dashArray: ecoMode ? '10, 10' : undefined,
                }}
              />
            )}

            {/* Truck marker */}
            <Marker
              position={[truck.position[1], truck.position[0]]}
              icon={createTruckIcon(truck.status)}
            >
              <Popup>
                <div className="text-sm min-w-[200px]">
                  <div className="font-bold text-lg text-slate-900 mb-2">{truck.id}</div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Driver:</span>
                      <span className="font-medium text-slate-900">{truck.driver}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Cargo:</span>
                      <span className="font-medium text-slate-900">${(truck.cargoValue / 1000).toFixed(0)}K</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Speed:</span>
                      <span className="font-medium text-slate-900">{truck.velocity} km/h</span>
                    </div>
                    <div className={`mt-2 px-2 py-1 rounded text-center font-semibold ${
                      truck.status === 'signal-lost' ? 'bg-slate-200 text-slate-700' :
                      truck.status === 'resolved' ? 'bg-purple-100 text-purple-700' :
                      truck.status === 'on-time' ? 'bg-green-100 text-green-700' :
                      truck.status === 'delayed' ? 'bg-amber-100 text-amber-700' : 
                      'bg-red-100 text-red-700'
                    }`}>
                      {truck.status.toUpperCase().replace('-', ' ')}
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          </React.Fragment>
        ))}

      </MapContainer>

      {/* Legend */}
      <div className="absolute top-4 right-4 bg-slate-900/90 backdrop-blur-lg border border-white/10 rounded-lg p-4 text-xs z-[1000] shadow-xl">
        <div className="font-semibold text-slate-200 mb-3 text-sm">Status Legend</div>
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full bg-green-500 shadow-lg"></div>
            <span className="text-slate-300">On Time</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full bg-amber-500 shadow-lg"></div>
            <span className="text-slate-300">Delayed</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full bg-red-500 shadow-lg"></div>
            <span className="text-slate-300">Critical</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full bg-purple-500 shadow-lg"></div>
            <span className="text-slate-300">Resolved</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full bg-slate-500 shadow-lg"></div>
            <span className="text-slate-300">Signal lost</span>
          </div>
        </div>
        
        {trucks.length > 0 && (
          <div className="mt-4 pt-3 border-t border-white/10">
            <div className="text-slate-400 text-xs">Active Trucks</div>
            <div className="text-teal-400 text-xl font-bold font-mono">{trucks.length}</div>
          </div>
        )}
      </div>
    </div>
  );
}
