// Enhanced OSRM Routing Utilities with caching and error handling

interface RouteResponse {
    coordinates: [number, number][];
    distance: number; // in meters
    duration: number; // in seconds
}

interface OSRMRoute {
    distance: number;
    duration: number;
    geometry: {
        coordinates: [number, number][];
    };
}

// In-memory cache for routes
const routeCache = new Map<string, RouteResponse>();

/**
 * Fetch route between two points using OSRM API
 * @param start [longitude, latitude]
 * @param end [longitude, latitude]
 * @param profile 'driving' | 'walking' | 'cycling'
 * @returns Route coordinates and metadata
 */
export async function fetchRoute(
    start: [number, number],
    end: [number, number],
    profile: 'driving' | 'walking' | 'cycling' = 'driving'
): Promise<RouteResponse | null> {
    // Create cache key
    const cacheKey = `${start[0]},${start[1]}-${end[0]},${end[1]}-${profile}`;

    // Check cache first
    if (routeCache.has(cacheKey)) {
        console.log('✅ Route loaded from cache');
        return routeCache.get(cacheKey)!;
    }

    try {
        const url = `https://router.project-osrm.org/route/v1/${profile}/${start[0]},${start[1]};${end[0]},${end[1]}?overview=full&geometries=geojson`;

        const response = await fetch(url, {
            signal: AbortSignal.timeout(5000), // 5s timeout
        });

        if (!response.ok) {
            throw new Error(`OSRM API error: ${response.status}`);
        }

        const data = await response.json();

        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
            const route: OSRMRoute = data.routes[0];
            const result: RouteResponse = {
                coordinates: route.geometry.coordinates as [number, number][],
                distance: route.distance,
                duration: route.duration,
            };

            // Cache the result
            routeCache.set(cacheKey, result);

            return result;
        }

        console.warn('No route found');
        return null;

    } catch (error) {
        console.error('Error fetching route:', error);

        // Return fallback interpolated route
        return generateFallbackRoute(start, end);
    }
}

/**
 * Fetch multiple alternative routes
 */
export async function fetchAlternativeRoutes(
    start: [number, number],
    end: [number, number],
    count: number = 3
): Promise<RouteResponse[]> {
    try {
        const url = `https://router.project-osrm.org/route/v1/driving/${start[0]},${start[1]};${end[0]},${end[1]}?overview=full&geometries=geojson&alternatives=${count}`;

        const response = await fetch(url, {
            signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) {
            throw new Error(`OSRM API error: ${response.status}`);
        }

        const data = await response.json();

        if (data.code === 'Ok' && data.routes) {
            return data.routes.map((route: OSRMRoute) => ({
                coordinates: route.geometry.coordinates as [number, number][],
                distance: route.distance,
                duration: route.duration,
            }));
        }

        return [];

    } catch (error) {
        console.error('Error fetching alternative routes:', error);
        return [];
    }
}

/**
 * Calculate ETA based on route and current speed
 */
export function calculateETA(
    routeDistance: number, // in meters
    currentSpeed: number, // in km/h
    trafficFactor: number = 1.0 // 1.0 = normal, 1.5 = heavy traffic
): Date {
    if (currentSpeed === 0) {
        // If stopped, estimate 30 min delay
        return new Date(Date.now() + 30 * 60 * 1000);
    }

    const speedMps = (currentSpeed * 1000) / 3600; // Convert km/h to m/s
    const baseTimeSeconds = routeDistance / speedMps;
    const adjustedTimeSeconds = baseTimeSeconds * trafficFactor;

    return new Date(Date.now() + adjustedTimeSeconds * 1000);
}

/**
 * Get distance between two points (Haversine formula)
 */
export function getDistance(
    point1: [number, number],
    point2: [number, number]
): number {
    const [lon1, lat1] = point1;
    const [lon2, lat2] = point2;

    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
}

/**
 * Format distance for display
 */
export function formatDistance(meters: number): string {
    if (meters < 1000) {
        return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Format duration for display
 */
export function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}

/**
 * Generate fallback route when OSRM fails (simple interpolation)
 */
function generateFallbackRoute(
    start: [number, number],
    end: [number, number]
): RouteResponse {
    const points: [number, number][] = [];
    const steps = 20;

    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const lon = start[0] + (end[0] - start[0]) * t;
        const lat = start[1] + (end[1] - start[1]) * t;
        points.push([lon, lat]);
    }

    const distance = getDistance(start, end);
    const duration = distance / 20; // Assume 20 m/s (~72 km/h)

    return {
        coordinates: points,
        distance,
        duration,
    };
}

/**
 * Clear route cache
 */
export function clearRouteCache(): void {
    routeCache.clear();
    console.log('Route cache cleared');
}

/**
 * Preload common routes
 */
export async function preloadRoutes(routes: Array<{ start: [number, number]; end: [number, number] }>): Promise<void> {
    console.log(`Preloading ${routes.length} routes...`);

    const promises = routes.map(({start, end}) => fetchRoute(start, end));
    await Promise.allSettled(promises);

    console.log('Routes preloaded');
}

// Common India city coordinates for quick reference
export const CITY_COORDINATES = {
    MUMBAI: [72.8777, 19.0760],
    PUNE: [73.8567, 18.5204],
    DELHI: [77.1025, 28.7041],
    BANGALORE: [77.5946, 12.9716],
    HYDERABAD: [78.4867, 17.3850],
    CHENNAI: [80.2707, 13.0827],
    KOLKATA: [88.3639, 22.5726],
    AHMEDABAD: [72.5714, 23.0225],
    JAIPUR: [75.7873, 26.9124],
    LUCKNOW: [80.9462, 26.8467],
} as const;
