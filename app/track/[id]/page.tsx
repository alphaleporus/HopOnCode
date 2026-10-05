'use client';

import {useEffect, useState} from 'react';
import {motion} from 'framer-motion';
import {Package, MapPin, Clock, CheckCircle2, Truck as TruckIcon, AlertCircle, X, Phone, Mail, MessageSquare} from 'lucide-react';
import {useParams} from 'next/navigation';
import dynamic from 'next/dynamic';

// Dynamically import the map component (client-side only)
const SupplyChainMap = dynamic(
    () => import('@/components/SupplyChainMap'),
    {
        ssr: false,
        loading: () => (
            <div className="w-full h-full flex items-center justify-center bg-slate-50">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"/>
                    <p className="text-muted">Loading map...</p>
                </div>
            </div>
        )
    }
);

interface TrackingData {
    orderId: string;
    truckId: string;
    status: 'pending' | 'in-transit' | 'delayed' | 'delivered';
    currentLocation: string;
    destination: string;
    destinationCoords: [number, number];
    estimatedDelivery: string;
    timeline: {
        status: string;
        timestamp: string;
        completed: boolean;
    }[];
    truck: {
        id: string;
        driver: string;
        position: [number, number];
        velocity: number;
        cargoValue: number;
        route: [number, number][];
    };
}

export default function TrackOrderPage() {
    const params = useParams();
    const orderId = params.id as string;

    const [tracking, setTracking] = useState<TrackingData | null>(null);
    const [loading, setLoading] = useState(true);
    const [showContactModal, setShowContactModal] = useState(false);

    useEffect(() => {
        // Simulate fetching tracking data
        setTimeout(() => {
            // Define route from Pune to Mumbai
            const puneCoords: [number, number] = [73.8567, 18.5204];
            const mumbaiCoords: [number, number] = [72.8777, 19.0760];
            
            // Create a route with intermediate points
            const route: [number, number][] = [
                puneCoords,
                [73.5, 18.7],
                [73.2, 18.9],
                [73.0, 19.0],
                mumbaiCoords
            ];
            
            setTracking({
                orderId: orderId || 'ORD-402',
                truckId: 'TRK-402',
                status: 'in-transit',
                currentLocation: 'Pune, Maharashtra',
                destination: 'Mumbai, Maharashtra',
                destinationCoords: mumbaiCoords,
                estimatedDelivery: new Date(Date.now() + 3 * 60 * 60 * 1000).toLocaleString(),
                timeline: [
                    {
                        status: 'Order Placed',
                        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toLocaleString(),
                        completed: true
                    },
                    {
                        status: 'Picked Up',
                        timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toLocaleString(),
                        completed: true
                    },
                    {status: 'In Transit', timestamp: new Date().toLocaleString(), completed: true},
                    {status: 'Out for Delivery', timestamp: 'Pending', completed: false},
                    {status: 'Delivered', timestamp: 'Pending', completed: false},
                ],
                truck: {
                    id: 'TRK-402',
                    driver: 'Priya Sharma',
                    position: puneCoords,
                    velocity: 68,
                    cargoValue: 125000,
                    route: route,
                }
            });
            setLoading(false);
        }, 1000);
    }, [orderId]);

    if (loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="text-center">
                    <motion.div
                        animate={{rotate: 360}}
                        transition={{duration: 1, repeat: Infinity, ease: 'linear'}}
                        className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full mx-auto mb-4"
                    />
                    <p className="text-muted">Loading tracking information...</p>
                </div>
            </div>
        );
    }

    if (!tracking) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="text-center">
                    <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4"/>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Order Not Found</h2>
                    <p className="text-muted">We couldn&apos;t find tracking information for order {orderId}</p>
                </div>
            </div>
        );
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'delivered':
                return 'text-green-600';
            case 'in-transit':
                return 'text-teal-600';
            case 'delayed':
                return 'text-amber-600';
            default:
                return 'text-muted';
        }
    };

    const getStatusBg = (status: string) => {
        switch (status) {
            case 'delivered':
                return 'bg-green-100';
            case 'in-transit':
                return 'bg-teal-100';
            case 'delayed':
                return 'bg-amber-100';
            default:
                return 'bg-slate-100';
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-cobalt rounded-lg">
                                <Package className="w-6 h-6 text-ink"/>
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-slate-800">Track Your Order</h1>
                                <p className="text-sm text-muted">Order #{tracking.orderId}</p>
                            </div>
                        </div>
                        <div className={`px-4 py-2 rounded-full ${getStatusBg(tracking.status)}`}>
              <span className={`text-sm font-semibold ${getStatusColor(tracking.status)} uppercase`}>
                {tracking.status.replace('-', ' ')}
              </span>
                        </div>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Left Column - Timeline & Details */}
                    <div className="lg:col-span-1 space-y-6">
                        {/* Delivery Info Card */}
                        <motion.div
                            initial={{opacity: 0, y: 20}}
                            animate={{opacity: 1, y: 0}}
                            className="bg-white rounded-lg shadow-sm border border-slate-200 p-6"
                        >
                            <h2 className="text-lg font-bold text-slate-800 mb-4">Delivery Information</h2>

                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <MapPin className="w-5 h-5 text-cobalt mt-0.5"/>
                                    <div>
                                        <p className="text-sm text-muted">Current Location</p>
                                        <p className="font-semibold text-slate-800">{tracking.currentLocation}</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <Package className="w-5 h-5 text-cobalt mt-0.5"/>
                                    <div>
                                        <p className="text-sm text-muted">Destination</p>
                                        <p className="font-semibold text-slate-800">{tracking.destination}</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <Clock className="w-5 h-5 text-cobalt mt-0.5"/>
                                    <div>
                                        <p className="text-sm text-muted">Estimated Delivery</p>
                                        <p className="font-semibold text-slate-800">{tracking.estimatedDelivery}</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <TruckIcon className="w-5 h-5 text-cobalt mt-0.5"/>
                                    <div>
                                        <p className="text-sm text-muted">Driver</p>
                                        <p className="font-semibold text-slate-800">{tracking.truck.driver}</p>
                                        <p className="text-xs text-muted mt-1">Truck {tracking.truckId} • {tracking.truck.velocity} km/h</p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                        {/* Timeline Card */}
                        <motion.div
                            initial={{opacity: 0, y: 20}}
                            animate={{opacity: 1, y: 0}}
                            transition={{delay: 0.1}}
                            className="bg-white rounded-lg shadow-sm border border-slate-200 p-6"
                        >
                            <h2 className="text-lg font-bold text-slate-800 mb-4">Delivery Timeline</h2>

                            <div className="space-y-4">
                                {tracking.timeline.map((event, index) => (
                                    <div key={index} className="flex gap-4">
                                        <div className="flex flex-col items-center">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                                event.completed ? 'bg-cobalt' : 'bg-slate-200'
                                            }`}>
                                                {event.completed ? (
                                                    <CheckCircle2 className="w-5 h-5 text-ink"/>
                                                ) : (
                                                    <div className="w-2 h-2 bg-slate-400 rounded-full"/>
                                                )}
                                            </div>
                                            {index < tracking.timeline.length - 1 && (
                                                <div
                                                    className={`w-0.5 h-12 ${event.completed ? 'bg-cobalt' : 'bg-slate-200'}`}/>
                                            )}
                                        </div>
                                        <div className="flex-1 pb-4">
                                            <p className={`font-semibold ${event.completed ? 'text-slate-800' : 'text-muted'}`}>
                                                {event.status}
                                            </p>
                                            <p className="text-sm text-muted">{event.timestamp}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>

                        {/* Support Card */}
                        <motion.div
                            initial={{opacity: 0, y: 20}}
                            animate={{opacity: 1, y: 0}}
                            transition={{delay: 0.2}}
                            className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-lg border border-teal-200 p-6"
                        >
                            <h3 className="font-bold text-slate-800 mb-2">Need Help?</h3>
                            <p className="text-sm text-muted mb-4">Our support team is available 24/7</p>
                            <button
                                className="w-full bg-cobalt hover:bg-teal-600 text-ink font-semibold py-3 rounded-lg transition-colors"
                                onClick={() => setShowContactModal(true)}
                            >
                                Contact Support
                            </button>
                        </motion.div>
                    </div>

                    {/* Right Column - Map */}
                    <motion.div
                        initial={{opacity: 0, x: 20}}
                        animate={{opacity: 1, x: 0}}
                        transition={{delay: 0.3}}
                        className="lg:col-span-2"
                    >
                        <div className="bg-white rounded-lg shadow-sm border border-slate-200 h-[600px] overflow-hidden">
                            <SupplyChainMap 
                                trucks={[{
                                    id: tracking.truckId,
                                    driver: tracking.truck.driver,
                                    position: tracking.truck.position,
                                    velocity: tracking.truck.velocity,
                                    cargoValue: tracking.truck.cargoValue,
                                    route: tracking.truck.route,
                                    destination: tracking.destinationCoords,
                                    status: tracking.status === 'delayed' ? 'delayed' : 
                                           tracking.status === 'delivered' ? 'resolved' : 'on-time'
                                }]}
                                ecoMode={false}
                            />
                        </div>
                    </motion.div>

                </div>
            </div>

            {/* Contact Support Modal */}
            {showContactModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{opacity: 0}}
                        animate={{opacity: 1}}
                        exit={{opacity: 0}}
                        className="absolute inset-0 bg-black/50 "
                        onClick={() => setShowContactModal(false)}
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{opacity: 0, scale: 0.95}}
                        animate={{opacity: 1, scale: 1}}
                        exit={{opacity: 0, scale: 0.95}}
                        className="relative bg-white rounded-lg shadow-lg p-6 w-full max-w-md z-10"
                    >
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-mist border border-line">
                                    <MessageSquare className="w-5 h-5 text-cobalt"/>
                                </div>
                                <h2 className="text-xl font-bold text-slate-800">Contact Support</h2>
                            </div>
                            <button
                                onClick={() => setShowContactModal(false)}
                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-muted"/>
                            </button>
                        </div>

                        <p className="text-muted mb-6">Our support team is available 24/7 to assist you with your order.</p>

                        <div className="space-y-4">
                            <div className="bg-slate-50 rounded-lg p-4 hover:bg-slate-100 transition-colors">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 rounded-lg bg-mist">
                                        <Phone className="w-5 h-5 text-cobalt"/>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm text-muted mb-1">Phone</p>
                                        <a href="tel:+11234567890" className="font-semibold text-slate-800 hover:text-teal-600 transition-colors">
                                            +1 (123) 456-7890
                                        </a>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-50 rounded-lg p-4 hover:bg-slate-100 transition-colors">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 rounded-lg bg-mist">
                                        <Mail className="w-5 h-5 text-cobalt"/>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm text-muted mb-1">Email</p>
                                        <a href="mailto:support@fleetfusion.com" className="font-semibold text-slate-800 hover:text-teal-600 transition-colors">
                                            support@fleetfusion.com
                                        </a>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-lg p-4 border border-teal-200">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 rounded-lg bg-cobalt">
                                        <MessageSquare className="w-5 h-5 text-ink"/>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm text-muted mb-1">Live Chat</p>
                                        <p className="font-semibold text-slate-800 mb-2">Available 24/7</p>
                                        <button className="w-full bg-cobalt hover:bg-teal-600 text-ink font-semibold py-2 px-4 rounded-lg transition-colors">
                                            Start Chat
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 pt-4 border-t border-slate-200">
                            <p className="text-xs text-muted text-center">
                                Average response time: Less than 2 minutes
                            </p>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Footer */}
            <footer className="bg-white border-t border-slate-200 mt-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <p className="text-sm text-muted">© 2026 FleetFusion. Real-time tracking powered by AI.</p>
                        <div className="flex gap-4">
                            <a href="#" className="text-sm text-muted hover:text-teal-600 transition-colors">Privacy Policy</a>
                            <a href="#" className="text-sm text-muted hover:text-teal-600 transition-colors">Terms of Service</a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
