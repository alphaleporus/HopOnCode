'use client';

import type {DecisionOption} from '@/lib/types';
import {formatINR} from '@/lib/utils/format';

/** Every option the engine compared for one incident, scored by expected total cost. */
export default function OptionsTable({options, best, confidence}: {
    options: DecisionOption[];
    best?: string;
    confidence?: number;
}) {
    return (
        <div>
            <div className="overflow-x-auto border border-line rounded-lg">
                <table className="w-full text-sm">
                    <thead className="bg-paper">
                    <tr className="text-left">
                        {['Option', 'Price', 'Arrives in', 'Late by', 'Reliability', 'Expected cost'].map((h, i) => (
                            <th key={h} className={`label-caps font-normal px-3 py-2 ${i ? 'text-right' : ''}`}>{h}</th>
                        ))}
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                    {options.map(o => {
                        const isBest = o.label === best;
                        return (
                            <tr key={o.label} className={isBest ? 'bg-mist' : ''}>
                                <td className="px-3 py-2">
                                    <span className={isBest ? 'font-semibold text-cobalt' : 'text-ink-2'}>
                                        {o.kind === 'wait' ? 'Do nothing (wait for recovery)' : o.provider}
                                    </span>
                                    {isBest && <span className="ml-2 label-caps !text-cobalt">Best</span>}
                                </td>
                                <td className="px-3 py-2 text-right mono-numbers">{o.kind === 'wait' ? '—' : formatINR(o.direct_cost)}</td>
                                <td className="px-3 py-2 text-right mono-numbers">{o.arrival_hours.toFixed(1)} h</td>
                                <td className={`px-3 py-2 text-right mono-numbers ${o.lateness_hours > 0 ? 'text-alert' : 'text-clear'}`}>
                                    {o.lateness_hours > 0 ? `${o.lateness_hours.toFixed(1)} h` : 'on time'}
                                </td>
                                <td className="px-3 py-2 text-right mono-numbers">{Math.round(o.reliability * 100)}%</td>
                                <td className="px-3 py-2 text-right mono-numbers font-semibold">{formatINR(o.expected_cost)}</td>
                            </tr>
                        );
                    })}
                    </tbody>
                </table>
            </div>
            <p className="text-xs text-muted mt-2">
                Expected cost = price + penalty still likely after the fix, weighted by the carrier&apos;s reliability.
                {confidence !== undefined && confidence > 0 && ` Confidence ${Math.round(confidence * 100)}%.`}
            </p>
        </div>
    );
}
