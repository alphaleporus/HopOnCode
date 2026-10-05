'use client';

import type {DecisionRecord} from '@/lib/types';
import {formatINR} from '@/lib/utils/format';

export default function DecisionLog({decisions}: { decisions: DecisionRecord[] }) {
    return (
        <div className="glass-card rounded-2xl p-6 border border-white/10">
            <h3 className="text-xl font-bold text-white mb-1">Decision log</h3>
            <p className="text-sm text-slate-400 mb-4">Every recommendation an operator acted on (full audit trail is kept on the server)</p>
            {decisions.length === 0 ? (
                <div className="text-sm text-slate-500 py-6 text-center">No decisions yet.</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                        <tr className="text-left text-slate-400 border-b border-white/10">
                            <th className="py-2 pr-4 font-medium">Time</th>
                            <th className="py-2 pr-4 font-medium">Truck</th>
                            <th className="py-2 pr-4 font-medium">Problem</th>
                            <th className="py-2 pr-4 font-medium">Decision</th>
                            <th className="py-2 pr-4 font-medium text-right">At risk</th>
                            <th className="py-2 pr-4 font-medium text-right">Paid</th>
                            <th className="py-2 font-medium text-right">Saved</th>
                        </tr>
                        </thead>
                        <tbody>
                        {decisions.map(d => (
                            <tr key={d.id} className="border-b border-white/5 text-slate-200">
                                <td className="py-2 pr-4 mono-numbers text-slate-400">{new Date(d.time).toLocaleTimeString()}</td>
                                <td className="py-2 pr-4 mono-numbers">{d.truckId}</td>
                                <td className="py-2 pr-4 capitalize">{(d.incident || 'unexplained stop').replace('_', ' ')}</td>
                                <td className="py-2 pr-4">
                                    {d.action === 'execute'
                                        ? <span className="text-teal-300">{d.option}</span>
                                        : <span className="text-slate-400">Ignored</span>}
                                </td>
                                <td className="py-2 pr-4 text-right mono-numbers text-red-300">{formatINR(d.exposure)}</td>
                                <td className="py-2 pr-4 text-right mono-numbers">{d.action === 'execute' ? formatINR(d.cost) : '—'}</td>
                                <td className="py-2 text-right mono-numbers text-green-400">{d.action === 'execute' ? formatINR(d.netSavings) : '—'}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
