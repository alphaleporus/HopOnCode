'use client';

import {useState, useEffect, useCallback, useRef} from 'react';
import {Truck, AgentEvent, ArbitrageOpportunity, DecisionRecord} from '../types';

export interface FleetMetrics {
    trucks: number;
    onTime: number;
    delayed: number;
    critical: number;
    resolved: number;
    actionable: number;
    exposure: number;
    cargoValue: number;
    reliefSpend: number;
    decisions: number;
    netSavings: number;
    penaltiesAvoided: number;
    extraCo2Kg: number;
    signalLost: number;
    aiAvailable: boolean;
    aiEnabled: boolean;
}

interface WebSocketDataMessage {
    trucks?: Truck[];
    events?: AgentEvent[];
    arbitrage?: ArbitrageOpportunity | null;
    metrics?: FleetMetrics;
    decisions?: DecisionRecord[];
}

interface WebSocketMessage {
    type: string;
    data?: WebSocketDataMessage | ArbitrageOpportunity;
    truckId?: string;
    timestamp?: string;
}

interface WebSocketState {
    trucks: Truck[];
    events: AgentEvent[];
    arbitrageOpportunity: ArbitrageOpportunity | null;
    metrics: FleetMetrics | null;
    decisions: DecisionRecord[];
    connected: boolean;
    error: string | null;
}

// Opportunities already handled in this session, keyed by incident (a truck can have several incidents)
const dismissedArbitrageSet = new Set<string>();
const opportunityKey = (o: ArbitrageOpportunity) => o.incidentId || o.truckId;

// Track connection time to ignore stale arbitrage from previous runs
let connectionTimestamp = 0;

// Process trucks - just pass through, backend sends correct routes
function processTrucks(trucks: Truck[]): Truck[] {
    // Validate that each truck has a route from the backend
    return trucks.map(truck => {
        // Ensure route exists and is properly formatted
        if (!truck.route || !Array.isArray(truck.route) || truck.route.length === 0) {
            console.warn(`⚠️ Truck ${truck.id} has invalid route:`, truck.route);
            // Provide fallback route if missing
            return {
                ...truck,
                route: truck.position && truck.destination 
                    ? [truck.position, truck.destination] 
                    : [[0, 0], [0, 0]]
            };
        }
        
        // Verify position is in correct format [lon, lat]
        if (!truck.position || truck.position.length !== 2) {
            console.warn(`⚠️ Truck ${truck.id} has invalid position:`, truck.position);
        }
        
        // Log route info for debugging (only for first few trucks)
        const truckIndex = trucks.indexOf(truck);
        if (truckIndex < 3) {
            console.log(`🚛 ${truck.id}: position [${truck.position[0].toFixed(4)}, ${truck.position[1].toFixed(4)}], ` +
                       `route has ${truck.route.length} points`);
        }
        
        // Return truck with backend route (no modification)
        return truck;
    });
}

export function useWebSocket(url: string = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8765') {
    const [state, setState] = useState<WebSocketState>({
        trucks: [],
        events: [],
        arbitrageOpportunity: null,
        connected: false,
        metrics: null,
        decisions: [],
        error: null,
    });

    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
    const reconnectAttempts = useRef(0);
    const connectRef = useRef<() => void>(() => {});
    const maxReconnectAttempts = 5;

    const handleMessage = useCallback((message: WebSocketMessage) => {
        switch (message.type) {
            case 'initial_state':
                // Don't show arbitrage from initial state (it's stale)
                if (message.data && 'trucks' in message.data) {
                    const data = message.data as WebSocketDataMessage;
                    
                    setState(prev => ({
                        ...prev,
                        trucks: data.trucks ? processTrucks(data.trucks) : prev.trucks,
                        events: data.events || prev.events,
                        metrics: data.metrics || prev.metrics,
                        decisions: data.decisions || prev.decisions,
                        // Don't set arbitrage from initial state
                    }));
                }
                break;

            case 'state_update':
                if (message.data && 'trucks' in message.data) {
                    const data = message.data as WebSocketDataMessage;
                    
                    setState(prev => {
                        const newState = { ...prev };
                        
                        // Process trucks - use backend routes directly
                        if (data.trucks && data.trucks.length > 0) {
                            newState.trucks = processTrucks(data.trucks);
                        }
                        if (data.decisions) {
                            newState.decisions = data.decisions;
                        }
                        if (data.metrics) {
                            newState.metrics = data.metrics;
                        }
                        
                        // Backend is the source of truth for incident state, including resolutions
                        if (data.events && data.events.length > 0) {
                            newState.events = data.events;
                        }

                        // Check for arbitrage in the data - but only if fresh and not dismissed
                        if (data.arbitrage && data.arbitrage.truckId) {
                            const arbitrageKey = opportunityKey(data.arbitrage);
                            const isFresh = isArbitrageFresh();
                            const isDismissed = dismissedArbitrageSet.has(arbitrageKey);
                            const hasExisting = !!prev.arbitrageOpportunity;
                            
                            console.log('💰 Arbitrage received:', {
                                truckId: arbitrageKey,
                                isFresh,
                                isDismissed,
                                hasExisting,
                                netSavings: data.arbitrage.netSavings
                            });
                            
                            // Only show if fresh, not dismissed, and no existing popup
                            if (isFresh && !isDismissed && !hasExisting) {
                                console.log('✅ Showing arbitrage popup!');
                                newState.arbitrageOpportunity = data.arbitrage;
                            } else {
                                console.log('⏭️  Skipping arbitrage:', {
                                    reason: !isFresh ? 'too soon after connect' : isDismissed ? 'already dismissed' : 'popup already showing'
                                });
                            }
                        }
                        
                        return newState;
                    });
                }
                break;

            case 'arbitrage_opportunity':
                if (message.data && 'truckId' in message.data && isArbitrageFresh()) {
                    const arbitrage = message.data as ArbitrageOpportunity;
                    const arbitrageKey = opportunityKey(arbitrage);
                    
                    // Only show if not already dismissed/executed
                    if (!dismissedArbitrageSet.has(arbitrageKey)) {
                        console.log('💰 Arbitrage opportunity (direct):', message.data);
                        setState(prev => {
                            if (prev.arbitrageOpportunity) return prev; // Don't overwrite existing
                            return {
                                ...prev,
                                arbitrageOpportunity: arbitrage,
                            };
                        });
                    }
                }
                break;

            case 'arbitrage_executed':
                setState(prev => ({
                    ...prev,
                    arbitrageOpportunity: null,
                }));
                break;

            case 'pong':
            case 'arbitrage_dismissed':
            case 'incident_classified':
            case 'ai_toggled':
                break;  // reflected in the next state_update

            case 'error':
                console.warn('Server:', (message as {message?: string}).message);
                break;

            default:
                console.log('Unknown message type:', message.type);
        }
    }, []);

    const connect = useCallback(() => {
        try {
            const ws = new WebSocket(url);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('✅ WebSocket connected');
                connectionTimestamp = Date.now(); // Track when we connected
                setState(prev => ({...prev, connected: true, error: null}));
                reconnectAttempts.current = 0;
            };

            ws.onmessage = (event) => {
                try {
                    const message: WebSocketMessage = JSON.parse(event.data);
                    handleMessage(message);
                } catch (error) {
                    console.error('Failed to parse WebSocket message:', error);
                }
            };

            ws.onerror = () => {
                // Expected while the backend is starting/restarting; onclose handles retry and messaging
                console.warn(`WebSocket error (${url}); will retry`);
            };

            ws.onclose = () => {
                console.log('❌ WebSocket disconnected');
                setState(prev => ({...prev, connected: false}));

                // Keep retrying forever with capped backoff, so a backend restart heals itself
                reconnectAttempts.current++;
                const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);
                if (reconnectAttempts.current >= maxReconnectAttempts) {
                    setState(prev => ({
                        ...prev,
                        error: 'Backend offline - start it with ./start-demo.sh (retrying automatically)'
                    }));
                }
                reconnectTimeoutRef.current = setTimeout(() => {
                    connectRef.current();
                }, delay);
            };
        } catch (error) {
            console.error('Failed to create WebSocket:', error);
            setState(prev => ({...prev, error: 'Failed to create WebSocket connection'}));
        }
    }, [url, handleMessage]);

    useEffect(() => {
        connectRef.current = connect;
    }, [connect]);

    const sendMessage = useCallback((message: Record<string, unknown>) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(message));
        } else {
            console.warn('WebSocket not connected, cannot send message');
        }
    }, []);

    const executeArbitrage = useCallback(() => {
        setState(prev => {
            if (!prev.arbitrageOpportunity) return prev;

            const truckId = prev.arbitrageOpportunity.truckId;

            // Mark this incident's opportunity as handled so it won't reappear
            dismissedArbitrageSet.add(opportunityKey(prev.arbitrageOpportunity));

            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    type: 'execute_arbitrage',
                    truckId: truckId,
                }));
            }

            // Update truck status to "resolved"
            const updatedTrucks = prev.trucks.map(truck => {
                if (truck.id === truckId) {
                    return { ...truck, status: 'resolved' as const };
                }
                return truck;
            });

            // Filter out existing critical events for this truck
            const filteredEvents = prev.events.filter(event => {
                const isCriticalForThisTruck = event.message.includes(truckId) && 
                                              event.message.includes('CRITICAL');
                return !isCriticalForThisTruck;
            });

            const newEvent: AgentEvent = {
                id: `evt-${Date.now()}`,
                timestamp: new Date(),
                type: 'system',
                message: `✅ ${truckId} RESOLVED - Relief truck dispatched! Problem solved.`,
                severity: 'info',
            };

            return {
                ...prev,
                trucks: updatedTrucks,
                events: [newEvent, ...filteredEvents],
                arbitrageOpportunity: null,
            };
        });
    }, []);

    const dismissArbitrage = useCallback(() => {
        setState(prev => {
            if (prev.arbitrageOpportunity) {
                dismissedArbitrageSet.add(opportunityKey(prev.arbitrageOpportunity));
                // Record the dismissal server-side too (audit log, removes it from opportunities)
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({
                        type: 'dismiss_arbitrage',
                        truckId: prev.arbitrageOpportunity.truckId,
                    }));
                }
            }
            return {...prev, arbitrageOpportunity: null};
        });
    }, []);

    // Dispatcher (office staff) sets the incident type for a stopped truck
    const classifyIncident = useCallback((truckId: string, incident: string) => {
        sendMessage({type: 'classify_incident', truckId, incident});
    }, [sendMessage]);

    // AI explanations on/off; decisions are deterministic either way
    const setAiEnabled = useCallback((enabled: boolean) => {
        sendMessage({type: 'set_ai', enabled});
    }, [sendMessage]);

    useEffect(() => {
        // Subscribing to an external system is what effects are for; connect() only
        // sets state synchronously in its error path.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        connect();

        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (wsRef.current) {
                // Detach handlers so an intentional close (incl. React dev double-mount) is silent
                // and doesn't schedule a reconnect
                const ws = wsRef.current;
                ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
                ws.close();
            }
        };
    }, [connect]);

    return {
        trucks: state.trucks,
        events: state.events,
        arbitrageOpportunity: state.arbitrageOpportunity,
        metrics: state.metrics,
        decisions: state.decisions,
        classifyIncident,
        setAiEnabled,
        connected: state.connected,
        error: state.error,
        executeArbitrage,
        dismissArbitrage,
        sendMessage,
    };
}

function isArbitrageFresh(): boolean {
    if (connectionTimestamp === 0) return false;
    const elapsed = Date.now() - connectionTimestamp;
    // Reduced from 5 seconds to 2 seconds to show arbitrage sooner
    return elapsed > 2000; // Only show arbitrage that comes after 2 seconds of connection
}
