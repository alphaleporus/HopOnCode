'use client';

import {Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';
import type {DecisionRecord} from '@/lib/types';
import {formatINR, formatINRCompact} from '@/lib/utils/format';

/** Cumulative net savings across executed decisions, oldest to newest. */
export default function SavingsChart({decisions}: { decisions: DecisionRecord[] }) {
    const executed = decisions.filter(d => d.action === 'execute').slice().reverse();
    const data = executed.map((d, i) => ({
        label: new Date(d.time).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}),
        truck: d.truckId,
        saved: Math.round(executed.slice(0, i + 1).reduce((sum, x) => sum + x.netSavings, 0)),
    }));

    return (
        <div className="bg-surface border border-line rounded-lg p-5">
            <h3 className="text-sm font-semibold mb-1">Savings over time</h3>
            <p className="text-sm text-muted mb-4">Total saved by executed decisions (this session)</p>
            {data.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-center text-muted text-sm px-6">
                    No decisions yet. Execute a recommendation on the dashboard and it will appear here.
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={data}>
                        <defs>
                            <linearGradient id="saved" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#1F9461" stopOpacity={0.4}/>
                                <stop offset="95%" stopColor="#1F9461" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E4E3DC"/>
                        <XAxis dataKey="label" stroke="#5A5F6B" fontSize={12}/>
                        <YAxis stroke="#5A5F6B" fontSize={12} tickFormatter={v => formatINRCompact(v)} width={80}/>
                        <Tooltip
                            contentStyle={{backgroundColor: '#FFFFFF', border: '1px solid #E4E3DC', borderRadius: 6, color: '#14171F'}}
                            formatter={(v: number) => [formatINR(v), 'Total saved']}
                        />
                        <Area type="monotone" dataKey="saved" stroke="#1F9461" strokeWidth={2} fill="url(#saved)"/>
                    </AreaChart>
                </ResponsiveContainer>
            )}
        </div>
    );
}
