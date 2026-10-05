'use client';

import {AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer} from 'recharts';

const data = [
    {month: 'Jan', savings: 2400, penalties: 4000},
    {month: 'Feb', savings: 3800, penalties: 3900},
    {month: 'Mar', savings: 4200, penalties: 3400},
    {month: 'Apr', savings: 5100, penalties: 2800},
    {month: 'May', savings: 6500, penalties: 2200},
    {month: 'Jun', savings: 8200, penalties: 1800},
];

export default function SavingsChart() {
    return (
        <div className="glass-card rounded-2xl p-6 border border-white/10">
            <div className="mb-6">
                <h3 className="text-xl font-bold text-white mb-2">Cost Savings Over Time</h3>
                <p className="text-sm text-slate-400">Monthly arbitrage savings vs potential penalties</p>
            </div>

            <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={data}>
                    <defs>
                        <linearGradient id="colorSavings" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorPenalties" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)"/>
                    <XAxis dataKey="month" stroke="#94a3b8" style={{fontSize: '12px'}}/>
                    <YAxis stroke="#94a3b8" style={{fontSize: '12px'}}/>
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
                        formatter={(value: number) => `$${value.toLocaleString()}`}
                    />
                    <Area
                        type="monotone"
                        dataKey="penalties"
                        stroke="#ef4444"
                        fillOpacity={1}
                        fill="url(#colorPenalties)"
                        strokeWidth={2}
                    />
                    <Area
                        type="monotone"
                        dataKey="savings"
                        stroke="#10b981"
                        fillOpacity={1}
                        fill="url(#colorSavings)"
                        strokeWidth={2}
                    />
                </AreaChart>
            </ResponsiveContainer>

            <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full"/>
                    <div>
                        <div className="text-sm text-slate-400">Total Savings</div>
                        <div className="text-lg font-bold text-white mono-numbers">$30,200</div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-red-500 rounded-full"/>
                    <div>
                        <div className="text-sm text-slate-400">Penalties Avoided</div>
                        <div className="text-lg font-bold text-white mono-numbers">$18,100</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
