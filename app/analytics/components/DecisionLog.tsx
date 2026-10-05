'use client';

import type {DecisionRecord} from '@/lib/types';
import {formatINR} from '@/lib/utils/format';

export default function DecisionLog({decisions}: { decisions: DecisionRecord[] }) {
    return (
        <div className="bg-surface border border-line rounded-lg p-5">
            <h3 className="text-sm font-semibold mb-1">Decision log</h3>
            <p className="text-sm text-muted mb-4">Every recommendation an operator acted on (full audit trail is kept on the server)</p>
            {decisions.length === 0 ? (
                <div className="text-sm text-muted py-6 text-center">No decisions yet.</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                        <tr className="text-left text-muted border-b border-line">
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
                            <tr key={d.id} className="border-b border-line text-ink-2">
                                <td className="py-2 pr-4 mono-numbers text-muted">{new Date(d.time).toLocaleTimeString()}</td>
                                <td className="py-2 pr-4 mono-numbers">{d.truckId}</td>
                                <td className="py-2 pr-4 capitalize">{(d.incident || 'unexplained stop').replace('_', ' ')}</td>
                                <td className="py-2 pr-4">
                                    {d.action === 'execute'
                                        ? <span className="text-cobalt">{d.option}</span>
                                        : <span className="text-muted">Ignored</span>}
                                </td>
                                <td className="py-2 pr-4 text-right mono-numbers text-alert">{formatINR(d.exposure)}</td>
                                <td className="py-2 pr-4 text-right mono-numbers">{d.action === 'execute' ? formatINR(d.cost) : '—'}</td>
                                <td className="py-2 text-right mono-numbers text-clear">{d.action === 'execute' ? formatINR(d.netSavings) : '—'}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
