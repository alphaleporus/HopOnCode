'use client';

import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import { Truck } from '@/lib/types';
import { formatINRCompact } from '@/lib/utils/format';
import { STATUS, statusStyle } from '@/lib/status';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Center of India for better initial view
const INDIA_CENTER: [number, number] = [20.5937, 78.9629];

interface SupplyChainMapProps {
  trucks: Truck[];
  ecoMode: boolean;
  onSelect?: (truckId: string) => void;
  selectedId?: string | null;
}

// Leaflet measures its container once; re-measure when the layout settles or resizes,
// otherwise tiles only load in part of the map.
function SizeWatcher() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const fix = () => map.invalidateSize();
    const timer = setTimeout(fix, 250);
    const observer = new ResizeObserver(fix);
    observer.observe(container);
    return () => { clearTimeout(timer); observer.disconnect(); };
  }, [map]);
  return null;
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
const createTruckIcon = (status: string, selected = false) => {
  const color = statusStyle(status).hex;
  const size = selected ? 18 : 14;
  // Flat status dot: brand calm, readable at a glance; the selected truck gets an ink ring
  return L.divIcon({
    className: 'custom-truck-icon',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};
      border:2px solid #fff;box-shadow:0 0 0 ${selected ? 2 : 1}px ${selected ? '#14171F' : 'rgba(20,23,31,0.25)'};"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

export default function SupplyChainMap({ trucks, ecoMode, onSelect, selectedId }: SupplyChainMapProps) {
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

        <SizeWatcher />
        <MapBoundsHandler trucks={trucks} />
        <CenterButton trucks={trucks} />

        {trucks.map((truck) => (
          <React.Fragment key={truck.id}>
            {/* Route polyline */}
            {truck.route && truck.route.length > 0 && (
              <Polyline
                positions={truck.route.map(coord => [coord[1], coord[0]])}
                pathOptions={{
                  color: statusStyle(truck.status).hex,
                  weight: truck.id === selectedId ? 5 : 3,
                  opacity: truck.id === selectedId ? 0.95 : 0.55,
                  dashArray: ecoMode ? '10, 10' : undefined,
                }}
              />
            )}

            {/* Truck marker */}
            <Marker
              position={[truck.position[1], truck.position[0]]}
              icon={createTruckIcon(truck.status, truck.id === selectedId)}
              eventHandlers={onSelect ? { click: () => onSelect(truck.id) } : undefined}
            >
              <Popup>
                <div className="text-sm min-w-[200px]">
                  <div className="font-bold text-lg text-ink mb-2">{truck.id}</div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted">Vehicle:</span>
                      <span className="font-medium text-ink">{truck.driver}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Cargo:</span>
                      <span className="font-medium text-ink">{formatINRCompact(truck.cargoValue)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Speed:</span>
                      <span className="font-medium text-ink">{truck.velocity} km/h</span>
                    </div>
                    <div className={`mt-2 px-2 py-1 rounded text-center font-semibold ${statusStyle(truck.status).chip}`}>
                      {statusStyle(truck.status).label}
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          </React.Fragment>
        ))}

      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-6 left-3 bg-surface/95 border border-line rounded-md px-3 py-2 z-[1000] flex flex-wrap gap-x-3 gap-y-1">
        {Object.entries(STATUS).map(([key, st]) => (
          <span key={key} className="flex items-center gap-1.5 text-[11px] text-ink-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: st.hex }} />{st.label}
          </span>
        ))}
      </div>
    </div>
  );
}
