'use client';

import {motion} from 'framer-motion';
import {TrendingUp, TrendingDown, Truck, DollarSign, Package, AlertTriangle} from 'lucide-react';

interface Metric {
    label: string;
    value: string;
    change: string;
    trend: 'up' | 'down';
    icon: React.ReactNode;
    color: string;
}

export default function MetricsOverview() {
    const metrics: Metric[] = [
        {
            label: 'Total Deliveries',
            value: '1,247',
            change: '+12.5%',
            trend: 'up',
            icon: <Package className="w-6 h-6"/>,
            color: 'teal',
        },
        {
            label: 'Active Trucks',
            value: '42',
            change: '+3',
            trend: 'up',
            icon: <Truck className="w-6 h-6"/>,
            color: 'blue',
        },
        {
            label: 'Total Savings',
            value: '$47,500',
            change: '+$8,200',
            trend: 'up',
            icon: <DollarSign className="w-6 h-6"/>,
            color: 'green',
        },
        {
            label: 'Incidents Resolved',
            value: '28',
            change: '-15%',
            trend: 'down',
            icon: <AlertTriangle className="w-6 h-6"/>,
            color: 'amber',
        },
    ];

    const getColorClasses = (color: string) => {
        const colors: Record<string, { bg: string; text: string; border: string }> = {
            teal: {bg: 'bg-teal-500/10', text: 'text-teal-500', border: 'border-teal-500/20'},
            blue: {bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/20'},
            green: {bg: 'bg-green-500/10', text: 'text-green-500', border: 'border-green-500/20'},
            amber: {bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/20'},
        };
        return colors[color];
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {metrics.map((metric, index) => {
                const colors = getColorClasses(metric.color);
                return (
                    <motion.div
                        key={metric.label}
                        initial={{opacity: 0, y: 20}}
                        animate={{opacity: 1, y: 0}}
                        transition={{delay: index * 0.1}}
                        whileHover={{y: -4}}
                        className="glass-card rounded-2xl p-6 border hover:border-white/20 transition-all"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className={`p-3 rounded-xl ${colors.bg} ${colors.border} border`}>
                                <div className={colors.text}>{metric.icon}</div>
                            </div>
                            <div className={`flex items-center gap-1 text-sm font-semibold ${
                                metric.trend === 'up' ? 'text-green-400' : 'text-red-400'
                            }`}>
                                {metric.trend === 'up' ? (
                                    <TrendingUp className="w-4 h-4"/>
                                ) : (
                                    <TrendingDown className="w-4 h-4"/>
                                )}
                                {metric.change}
                            </div>
                        </div>
                        <div className="text-3xl font-bold text-white mb-1 mono-numbers">{metric.value}</div>
                        <div className="text-sm text-slate-400">{metric.label}</div>
                    </motion.div>
                );
            })}
        </div>
    );
}
