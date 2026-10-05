'use client';

import type {Truck} from '@/lib/types';
import {RECOMMENDATION_LABEL, statusStyle} from '@/lib/status';
import {formatINR} from '@/lib/utils/format';

const ACTION_FIRST = ['EXECUTE', 'CONSIDER', 'CHECK_TRACKER', 'MONITOR', 'RESOLVED'];

function cause(t: Truck): string {
    if (t.status === 'signal-lost') return `No tracker data · ${t.silentMinutes ?? 0} min`;
    if (!t.stopped) {
        if (t.status === 'resolved') return 'Relief truck en route';
        const behind = (t.slackHours ?? 0) < 0 ? ` · running ${(-(t.slackHours ?? 0)).toFixed(1)} h behind` : '';
        return `Moving · ${Math.round(t.velocity)} km/h${behind}`;
    }
    const what = (t.incident || 'unexplained stop').replace('_', ' ');
    const src = t.incidentSource === 'dispatcher' ? ' · set by dispatcher' : t.incidentSource === 'telematics' ? ' · from tracker' : '';
    return `Stopped ${Math.round(t.stoppedMinutes ?? 0)} min · ${what}${src}`;
}

/** Every truck that needs attention, decisions first, then by money at risk. */
export default function IncidentInbox({trucks, selectedId, onSelect}: {
    trucks: Truck[];
    selectedId: string | null;
    onSelect: (id: string) => void;
}) {
    const rows = trucks
        .filter(t => t.status !== 'on-time')
        .sort((a, b) => {
            const ra = ACTION_FIRST.indexOf(a.recommendation ?? ''), rb = ACTION_FIRST.indexOf(b.recommendation ?? '');
            return (ra === -1 ? 9 : ra) - (rb === -1 ? 9 : rb) || (b.exposure ?? 0) - (a.exposure ?? 0);
        });

    return (
        <section className="bg-surface border border-line rounded-lg flex flex-col min-h-0">
            <header className="px-4 py-3 border-b border-line flex items-baseline justify-between">
                <h2 className="text-sm font-semibold">Incidents</h2>
                <span className="label-caps">{rows.length} need attention · {trucks.length - rows.length} on time</span>
            </header>
            {rows.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted">All trucks are on schedule.</div>
            ) : (
                <ul className="divide-y divide-line overflow-auto">
                    {rows.map(t => {
                        const s = statusStyle(t.status);
                        const needsDecision = t.recommendation === 'EXECUTE' || t.recommendation === 'CONSIDER';
                        return (
                            <li key={t.id}>
                                <button onClick={() => onSelect(t.id)}
                                        className={`w-full text-left px-4 py-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 hover:bg-paper transition-colors ${
                                            selectedId === t.id ? 'bg-mist' : ''}`}>
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`}/>
                                        <span className="mono-numbers text-sm font-semibold whitespace-nowrap">{t.id}</span>
                                        <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap ${s.chip}`}>{s.label}</span>
                                        {t.client && <span className="text-xs text-muted truncate min-w-0">{t.client}</span>}
                                    </div>
                                    <span className={`mono-numbers text-sm text-right whitespace-nowrap ${(t.exposure ?? 0) > 0 ? 'text-alert font-semibold' : 'text-muted'}`}>
                                        {(t.exposure ?? 0) > 0 ? formatINR(t.exposure ?? 0) : '—'}
                                    </span>
                                    <span className="text-xs text-muted truncate pl-4">{cause(t)}</span>
                                    <span className={`text-xs text-right whitespace-nowrap ${needsDecision ? 'text-cobalt font-semibold' : 'text-muted'}`}>
                                        {RECOMMENDATION_LABEL[t.recommendation ?? 'NONE'] ?? t.recommendation}
                                        {needsDecision && t.netSavings ? ` · saves ${formatINR(t.netSavings)}` : ''}
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}
