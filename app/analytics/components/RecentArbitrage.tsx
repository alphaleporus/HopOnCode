'use client';

import {motion} from 'framer-motion';
import {CheckCircle2, TrendingUp, Clock} from 'lucide-react';

interface ArbitrageEvent {
    id: string;
    truckId: string;
    route: string;
    savings: number;
    status: 'executed' | 'pending' | 'dismissed';
    timestamp: string;
}

export default function RecentArbitrage() {
    const events: ArbitrageEvent[] = [
        {
            id: 'ARB-001',
            truckId: 'TRK-402',
            route: 'Pune → Mumbai',
            savings: 1700,
            status: 'executed',
            timestamp: '2 hours ago',
        },
        {
            id: 'ARB-002',
            truckId: 'TRK-305',
            route: 'Bangalore → Hyderabad',
            savings: 1400,
            status: 'executed',
            timestamp: '5 hours ago',
        },
        {
            id: 'ARB-003',
            truckId: 'TRK-518',
            route: 'Kolkata → Bhubaneswar',
            savings: 950,
            status: 'pending',
            timestamp: '8 hours ago',
        },
        {
            id: 'ARB-004',
            truckId: 'TRK-221',
            route: 'Delhi → Jaipur',
            savings: 1200,
            status: 'executed',
            timestamp: '1 day ago',
        },
    ];

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'executed':
                return 'text-green-400';
            case 'pending':
                return 'text-amber-400';
            case 'dismissed':
                return 'text-slate-500';
            default:
                return 'text-slate-400';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'executed':
                return <CheckCircle2 className="w-5 h-5"/>;
            case 'pending':
                return <Clock className="w-5 h-5"/>;
            default:
                return <TrendingUp className="w-5 h-5"/>;
        }
    };

    return (
        <div className="glass-card rounded-2xl p-6 border border-white/10">
            <div className="mb-6">
                <h3 className="text-xl font-bold text-white mb-2">Recent Arbitrage Opportunities</h3>
                <p className="text-sm text-slate-400">Latest cost-saving executions and opportunities</p>
            </div>

            <div className="space-y-4">
                {events.map((event, index) => (
                    <motion.div
                        key={event.id}
                        initial={{opacity: 0, x: -20}}
                        animate={{opacity: 1, x: 0}}
                        transition={{delay: index * 0.1}}
                        className="flex items-center justify-between p-4 rounded-xl bg-slate-800/30 hover:bg-slate-800/50 transition-colors border border-white/5"
                    >
                        <div className="flex items-center gap-4 flex-1">
                            <div className={`${getStatusColor(event.status)}`}>
                                {getStatusIcon(event.status)}
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-semibold text-white">{event.truckId}</span>
                                    <span className="text-slate-400">•</span>
                                    <span className="text-slate-400 text-sm">{event.route}</span>
                                </div>
                                <div className="text-sm text-slate-500">{event.timestamp}</div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-lg font-bold text-green-400 mono-numbers">
                                +${event.savings.toLocaleString()}
                            </div>
                            <div className={`text-xs font-semibold uppercase ${getStatusColor(event.status)}`}>
                                {event.status}
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            <div className="mt-6 pt-6 border-t border-white/10 flex items-center justify-between">
                <div>
                    <div className="text-sm text-slate-400">Total Opportunities</div>
                    <div className="text-2xl font-bold text-white mono-numbers">28</div>
                </div>
                <div>
                    <div className="text-sm text-slate-400">Execution Rate</div>
                    <div className="text-2xl font-bold text-teal-400 mono-numbers">85%</div>
                </div>
                <div>
                    <div className="text-sm text-slate-400">Avg. Savings</div>
                    <div className="text-2xl font-bold text-green-400 mono-numbers">$1.3K</div>
                </div>
            </div>
        </div>
    );
}
