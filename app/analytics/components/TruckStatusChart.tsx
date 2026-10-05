'use client';

import {Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip} from 'recharts';
import type {FleetMetrics} from '@/lib/hooks/useWebSocket';

export default function TruckStatusChart({metrics}: { metrics: FleetMetrics | null }) {
    const data = [
        {name: 'On time', value: metrics?.onTime ?? 0, color: '#10b981'},
        {name: 'Delayed', value: metrics?.delayed ?? 0, color: '#f59e0b'},
        {name: 'Critical', value: metrics?.critical ?? 0, color: '#ef4444'},
        {name: 'Resolved', value: metrics?.resolved ?? 0, color: '#a855f7'},
        {name: 'Signal lost', value: metrics?.signalLost ?? 0, color: '#64748b'},
    ].filter(d => d.value > 0);

    return (
        <div className="glass-card rounded-2xl p-6 border border-white/10">
            <h3 className="text-xl font-bold text-white mb-1">Fleet status right now</h3>
            <p className="text-sm text-slate-400 mb-4">Live from the decision engine</p>
            {data.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-slate-500 text-sm">Waiting for trucks…</div>
            ) : (
                <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                        <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value">
                            {data.map(d => <Cell key={d.name} fill={d.color}/>)}
                        </Pie>
                        <Tooltip contentStyle={{backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, color: '#fff'}}/>
                        <Legend wrapperStyle={{color: '#cbd5e1'}}/>
                    </PieChart>
                </ResponsiveContainer>
            )}
        </div>
    );
}
