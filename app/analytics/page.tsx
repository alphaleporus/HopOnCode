'use client';

import {useState} from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {motion, AnimatePresence} from 'framer-motion';
import {Home, BarChart3, Download, RefreshCcw, X, FileJson, FileText} from 'lucide-react';
import UserMenu from '@/components/dashboard/UserMenu';
import MetricsOverview from './components/MetricsOverview';
import SavingsChart from './components/SavingsChart';
import TruckStatusChart from './components/TruckStatusChart';
import RecentArbitrage from './components/RecentArbitrage';

export default function AnalyticsPage() {
    const [refreshing, setRefreshing] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);

    const handleRefresh = () => {
        setRefreshing(true);
        setTimeout(() => setRefreshing(false), 1000);
    };

    // Generate comprehensive analytics data
    const generateAnalyticsData = () => {
        return {
            exportDate: new Date().toISOString(),
            summary: {
                totalDeliveries: 1247,
                deliveryGrowth: '+12.5%',
                activeTrucks: 42,
                truckChange: '+3',
                totalSavings: 47500,
                savingsGrowth: '+$8,200',
                incidentsResolved: 28,
                incidentChange: '-15%'
            },
            costSavings: {
                totalSavings: 30200,
                penaltiesAvoided: 18100,
                monthlyData: [
                    { month: 'Jan', savings: 2500, penalties: 4200 },
                    { month: 'Feb', savings: 3100, penalties: 3800 },
                    { month: 'Mar', savings: 4200, penalties: 3500 },
                    { month: 'Apr', savings: 5100, penalties: 3200 },
                    { month: 'May', savings: 6800, penalties: 2100 },
                    { month: 'Jun', savings: 8500, penalties: 1300 }
                ]
            },
            fleetStatus: {
                totalTrucks: 42,
                onTimeRate: '95.2%',
                statusDistribution: {
                    onTime: 35,
                    inTransit: 4,
                    delayed: 2,
                    critical: 1
                }
            },
            topRoutes: [
                { route: 'Pune → Mumbai', deliveries: 342 },
                { route: 'Delhi → Jaipur', deliveries: 287 },
                { route: 'Bangalore → Chennai', deliveries: 234 }
            ],
            performanceMetrics: {
                avgDeliveryTime: '3.2h',
                fuelEfficiency: '8.2 km/L',
                customerRating: 4.8
            },
            carbonImpact: {
                co2Saved: '2.4T',
                creditsEarned: '$450',
                treesEquivalent: 48
            },
            recentArbitrage: [
                {
                    id: 'ARB-001',
                    truck: 'TRK-402',
                    type: 'Route Optimization',
                    projectedPenalty: 5200,
                    solution: 'Alternative Route via NH48',
                    solutionCost: 800,
                    netSavings: 4400,
                    status: 'Executed',
                    timestamp: '2 hours ago'
                },
                {
                    id: 'ARB-002',
                    truck: 'TRK-301',
                    type: 'Warehouse Switch',
                    projectedPenalty: 3800,
                    solution: 'Redirect to nearby distribution center',
                    solutionCost: 500,
                    netSavings: 3300,
                    status: 'Executed',
                    timestamp: '5 hours ago'
                }
            ]
        };
    };

    // Convert data to CSV format
    const convertToCSV = (data: ReturnType<typeof generateAnalyticsData>) => {
        const csv: string[] = [];
        
        // Summary section
        csv.push('ANALYTICS SUMMARY');
        csv.push(`Export Date,${data.exportDate}`);
        csv.push('');
        csv.push('Key Metrics');
        csv.push('Metric,Value,Change');
        csv.push(`Total Deliveries,${data.summary.totalDeliveries},${data.summary.deliveryGrowth}`);
        csv.push(`Active Trucks,${data.summary.activeTrucks},${data.summary.truckChange}`);
        csv.push(`Total Savings,$${data.summary.totalSavings},${data.summary.savingsGrowth}`);
        csv.push(`Incidents Resolved,${data.summary.incidentsResolved},${data.summary.incidentChange}`);
        csv.push('');
        
        // Monthly savings
        csv.push('MONTHLY COST SAVINGS');
        csv.push('Month,Savings,Penalties Avoided');
        data.costSavings.monthlyData.forEach((item) => {
            csv.push(`${item.month},$${item.savings},$${item.penalties}`);
        });
        csv.push('');
        
        // Fleet status
        csv.push('FLEET STATUS');
        csv.push('Status,Count');
        csv.push(`On Time,${data.fleetStatus.statusDistribution.onTime}`);
        csv.push(`In Transit,${data.fleetStatus.statusDistribution.inTransit}`);
        csv.push(`Delayed,${data.fleetStatus.statusDistribution.delayed}`);
        csv.push(`Critical,${data.fleetStatus.statusDistribution.critical}`);
        csv.push('');
        
        // Top routes
        csv.push('TOP ROUTES');
        csv.push('Route,Deliveries');
        data.topRoutes.forEach((item) => {
            csv.push(`${item.route},${item.deliveries}`);
        });
        csv.push('');
        
        // Recent arbitrage
        csv.push('RECENT ARBITRAGE OPPORTUNITIES');
        csv.push('ID,Truck,Type,Projected Penalty,Solution,Solution Cost,Net Savings,Status,Time');
        data.recentArbitrage.forEach((item) => {
            csv.push(`${item.id},${item.truck},${item.type},$${item.projectedPenalty},${item.solution},$${item.solutionCost},$${item.netSavings},${item.status},${item.timestamp}`);
        });
        
        return csv.join('\n');
    };

    // Download file helper
    const downloadFile = (content: string, filename: string, type: string) => {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleExport = () => {
        setShowExportModal(true);
    };

    const exportAsJSON = () => {
        const data = generateAnalyticsData();
        const jsonString = JSON.stringify(data, null, 2);
        const timestamp = new Date().toISOString().split('T')[0];
        downloadFile(jsonString, `analytics-${timestamp}.json`, 'application/json');
        setShowExportModal(false);
    };

    const exportAsCSV = () => {
        const data = generateAnalyticsData();
        const csvString = convertToCSV(data);
        const timestamp = new Date().toISOString().split('T')[0];
        downloadFile(csvString, `analytics-${timestamp}.csv`, 'text/csv');
        setShowExportModal(false);
    };

    return (
        <div className="h-screen w-screen overflow-hidden gradient-bg">
            {/* Sidebar */}
            <div className="fixed left-0 top-0 h-full w-72 glass-card border-r border-white/10 z-40 p-6">
                <Link href="/" className="flex items-center gap-2 mb-8">
                    <div className="relative w-40 h-10">
                        <Image 
                            src="/Logo.png" 
                            alt="FleetFusion Logo" 
                            width={160} 
                            height={40}
                            className="object-contain"
                        />
                    </div>
                </Link>

                <nav className="space-y-2">
                    <Link href="/dashboard">
                        <div
                            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/5 text-slate-300 hover:text-white transition-colors">
                            <Home className="w-5 h-5"/>
                            <span className="font-medium">Dashboard</span>
                        </div>
                    </Link>
                    <div
                        className="flex items-center gap-3 px-4 py-3 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400">
                        <BarChart3 className="w-5 h-5"/>
                        <span className="font-medium">Analytics</span>
                    </div>
                </nav>

                <div className="absolute bottom-6 left-6 right-6">
                    <div className="glass-card p-4 rounded-lg">
                        <div className="text-xs text-slate-500 uppercase mb-2">Data Updated</div>
                        <div className="flex items-center gap-2">
                            <motion.div
                                animate={{scale: [1, 1.2, 1], opacity: [1, 0.5, 1]}}
                                transition={{duration: 2, repeat: Infinity}}
                                className="w-2 h-2 bg-teal-500 rounded-full"
                            />
                            <span className="text-sm font-semibold text-teal-400">Real-time</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="ml-72 flex flex-col h-full overflow-hidden">
                {/* Top Bar */}
                <div className="glass-nav border-b border-white/10 px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-xl font-bold text-white">Analytics Dashboard</h1>
                            <p className="text-sm text-slate-400">Comprehensive supply chain insights</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleRefresh}
                                className="btn-ghost px-4 py-2 rounded-lg flex items-center gap-2"
                                disabled={refreshing}
                            >
                                <RefreshCcw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}/>
                                <span className="text-sm font-medium text-white">Refresh</span>
                            </button>
                            <button
                                onClick={handleExport}
                                className="btn-primary px-4 py-2 rounded-lg flex items-center gap-2"
                            >
                                <Download className="w-4 h-4"/>
                                <span className="text-sm font-medium">Export</span>
                            </button>
                            <UserMenu/>
                        </div>
                    </div>
                </div>

                {/* Analytics Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="max-w-[1600px] mx-auto space-y-6">
                        {/* Metrics Overview */}
                        <MetricsOverview/>

                        {/* Charts Row */}
                        <div className="grid lg:grid-cols-2 gap-6">
                            <SavingsChart/>
                            <TruckStatusChart/>
                        </div>

                        {/* Recent Arbitrage */}
                        <RecentArbitrage/>

                        {/* Additional Stats */}
                        <div className="grid md:grid-cols-3 gap-6">
                            <motion.div
                                initial={{opacity: 0, y: 20}}
                                animate={{opacity: 1, y: 0}}
                                transition={{delay: 0.5}}
                                className="glass-card rounded-2xl p-6 border border-white/10"
                            >
                                <h4 className="text-sm font-semibold text-slate-400 mb-4">Top Routes</h4>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-white text-sm">Pune → Mumbai</span>
                                        <span className="text-teal-400 font-semibold mono-numbers">342</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-white text-sm">Delhi → Jaipur</span>
                                        <span className="text-teal-400 font-semibold mono-numbers">287</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-white text-sm">Bangalore → Chennai</span>
                                        <span className="text-teal-400 font-semibold mono-numbers">234</span>
                                    </div>
                                </div>
                            </motion.div>

                            <motion.div
                                initial={{opacity: 0, y: 20}}
                                animate={{opacity: 1, y: 0}}
                                transition={{delay: 0.6}}
                                className="glass-card rounded-2xl p-6 border border-white/10"
                            >
                                <h4 className="text-sm font-semibold text-slate-400 mb-4">Performance Metrics</h4>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-white text-sm">Avg. Delivery Time</span>
                                        <span className="text-white font-semibold mono-numbers">3.2h</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-white text-sm">Fuel Efficiency</span>
                                        <span className="text-green-400 font-semibold mono-numbers">8.2 km/L</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-white text-sm">Customer Rating</span>
                                        <span className="text-amber-400 font-semibold mono-numbers">4.8/5</span>
                                    </div>
                                </div>
                            </motion.div>

                            <motion.div
                                initial={{opacity: 0, y: 20}}
                                animate={{opacity: 1, y: 0}}
                                transition={{delay: 0.7}}
                                className="glass-card rounded-2xl p-6 border border-white/10"
                            >
                                <h4 className="text-sm font-semibold text-slate-400 mb-4">Carbon Impact</h4>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-white text-sm">CO₂ Saved</span>
                                        <span className="text-green-400 font-semibold mono-numbers">2.4T</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-white text-sm">Credits Earned</span>
                                        <span className="text-green-400 font-semibold mono-numbers">$450</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-white text-sm">Trees Equivalent</span>
                                        <span className="text-green-400 font-semibold mono-numbers">48</span>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {showExportModal && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                        {/* Backdrop */}
                        <motion.div
                            initial={{opacity: 0}}
                            animate={{opacity: 1}}
                            exit={{opacity: 0}}
                            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                            onClick={() => setShowExportModal(false)}
                        />

                        {/* Modal */}
                        <motion.div
                            initial={{opacity: 0, scale: 0.95}}
                            animate={{opacity: 1, scale: 1}}
                            exit={{opacity: 0, scale: 0.95}}
                            className="relative glass-card rounded-2xl border border-white/10 shadow-2xl p-6 w-full max-w-md z-10"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-teal-500/20 border border-teal-500/30">
                                        <Download className="w-5 h-5 text-teal-400"/>
                                    </div>
                                    <h2 className="text-xl font-bold text-white">Export Analytics</h2>
                                </div>
                                <button
                                    onClick={() => setShowExportModal(false)}
                                    className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5 text-slate-400"/>
                                </button>
                            </div>

                            <p className="text-slate-300 mb-6">Choose your preferred format to export the analytics data:</p>

                            <div className="space-y-3">
                                {/* JSON Export */}
                                <button
                                    onClick={exportAsJSON}
                                    className="w-full glass-card rounded-xl p-4 border border-white/10 hover:border-teal-500/50 hover:bg-white/5 transition-all group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 rounded-lg bg-teal-500/20 border border-teal-500/30 group-hover:bg-teal-500/30 transition-colors">
                                            <FileJson className="w-6 h-6 text-teal-400"/>
                                        </div>
                                        <div className="flex-1 text-left">
                                            <div className="font-semibold text-white mb-1">JSON Format</div>
                                            <div className="text-xs text-slate-400">Complete data structure with full details</div>
                                        </div>
                                    </div>
                                </button>

                                {/* CSV Export */}
                                <button
                                    onClick={exportAsCSV}
                                    className="w-full glass-card rounded-xl p-4 border border-white/10 hover:border-teal-500/50 hover:bg-white/5 transition-all group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 rounded-lg bg-teal-500/20 border border-teal-500/30 group-hover:bg-teal-500/30 transition-colors">
                                            <FileText className="w-6 h-6 text-teal-400"/>
                                        </div>
                                        <div className="flex-1 text-left">
                                            <div className="font-semibold text-white mb-1">CSV Format</div>
                                            <div className="text-xs text-slate-400">Spreadsheet-compatible tabular data</div>
                                        </div>
                                    </div>
                                </button>
                            </div>

                            <div className="mt-6 pt-4 border-t border-white/10">
                                <button
                                    onClick={() => setShowExportModal(false)}
                                    className="w-full px-4 py-2 rounded-lg hover:bg-white/5 text-slate-300 hover:text-white transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
