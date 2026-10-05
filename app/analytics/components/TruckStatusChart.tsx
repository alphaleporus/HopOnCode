'use client';

import {PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip} from 'recharts';

const data = [
    {name: 'On-Time', value: 35, color: '#10b981'},
    {name: 'In-Transit', value: 7, color: '#2dd4bf'},
    {name: 'Delayed', value: 3, color: '#f59e0b'},
    {name: 'Critical', value: 1, color: '#ef4444'},
];

export default function TruckStatusChart() {
    return (
        <div className="glass-card rounded-2xl p-6 border border-white/10">
            <div className="mb-4">
                <h3 className="text-xl font-bold text-white mb-2">Fleet Status Distribution</h3>
                <p className="text-sm text-slate-400">Current status of all active trucks</p>
            </div>

            <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                    >
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color}/>
                        ))}
                    </Pie>
                    <Tooltip
                        contentStyle={{
                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            borderRadius: '8px',
                            color: '#ffffff',
                            padding: '8px 12px',
                            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
                        }}
                        itemStyle={{
                            color: '#ffffff',
                        }}
                        labelStyle={{
                            color: '#ffffff',
                            fontWeight: '600',
                        }}
                    />
                    <Legend
                        verticalAlign="bottom"
                        height={36}
                        iconType="circle"
                        formatter={(value: string) => (
                            <span style={{color: '#94a3b8', fontSize: '14px'}}>{value}</span>
                        )}
                    />
                </PieChart>
            </ResponsiveContainer>

            <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-white/10">
                <div>
                    <div className="text-2xl font-bold text-white mono-numbers">42</div>
                    <div className="text-sm text-slate-400">Total Trucks</div>
                </div>
                <div>
                    <div className="text-2xl font-bold text-green-400 mono-numbers">95.2%</div>
                    <div className="text-sm text-slate-400">On-Time Rate</div>
                </div>
            </div>
        </div>
    );
}
