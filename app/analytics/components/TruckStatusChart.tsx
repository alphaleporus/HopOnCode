'use client';

import {Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip} from 'recharts';
import type {FleetMetrics} from '@/lib/hooks/useWebSocket';

export default function TruckStatusChart({metrics}: { metrics: FleetMetrics | null }) {
    const data = [
        {name: 'On time', value: metrics?.onTime ?? 0, color: '#1F9461'},
        {name: 'Delayed', value: metrics?.delayed ?? 0, color: '#E8962B'},
        {name: 'Critical', value: metrics?.critical ?? 0, color: '#C2410C'},
        {name: 'Resolved', value: metrics?.resolved ?? 0, color: '#2F4FE0'},
        {name: 'Signal lost', value: metrics?.signalLost ?? 0, color: '#8A8F99'},
    ].filter(d => d.value > 0);

    return (
        <div className="bg-surface border border-line rounded-lg p-5">
            <h3 className="text-sm font-semibold mb-1">Fleet status right now</h3>
            <p className="text-sm text-muted mb-4">Live from the decision engine</p>
            {data.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-muted text-sm">Waiting for trucks…</div>
            ) : (
                <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                        <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value">
                            {data.map(d => <Cell key={d.name} fill={d.color}/>)}
                        </Pie>
                        <Tooltip contentStyle={{backgroundColor: '#FFFFFF', border: '1px solid #E4E3DC', borderRadius: 6, color: '#14171F'}}/>
                        <Legend wrapperStyle={{color: '#3A3F4C', fontSize: 12}}/>
                    </PieChart>
                </ResponsiveContainer>
            )}
        </div>
    );
}
