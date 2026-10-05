'use client';

import type {FleetMetrics} from '@/lib/hooks/useWebSocket';
import {formatINRCompact} from '@/lib/utils/format';

/** Live session numbers, in the same tile style as the Operations dashboard. */
export default function MetricsOverview({metrics: m}: { metrics: FleetMetrics | null }) {
    const onTimePct = m && m.trucks ? Math.round(((m.onTime + m.resolved) / m.trucks) * 100) : null;
    const tiles: [string, string, string, string?][] = [
        ['Net savings', formatINRCompact(m?.netSavings ?? 0), 'from executed decisions', 'text-clear'],
        ['Penalties avoided', formatINRCompact(m?.penaltiesAvoided ?? 0), 'contract penalties + spoilage', 'text-clear'],
        ['Money at risk now', formatINRCompact(m?.exposure ?? 0), `${m?.critical ?? 0} critical truck(s)`, 'text-alert'],
        ['Decisions executed', String(m?.decisions ?? 0), `${m?.actionable ?? 0} waiting for review`],
        ['Fleet on time', onTimePct === null ? '—' : `${onTimePct}%`, `${m?.trucks ?? 0} trucks tracked`, 'text-clear'],
        ['Relief spend', formatINRCompact(m?.reliefSpend ?? 0), 'paid to relief carriers'],
        ['Extra CO₂', `${(m?.extraCo2Kg ?? 0).toFixed(0)} kg`, 'relief trucks driving to pickup'],
        ['Trackers silent', String(m?.signalLost ?? 0), 'no data recently'],
    ];

    return (
        <section>
            <h2 className="label-caps mb-2">This session (live)</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {tiles.map(([label, value, hint, tone]) => (
                    <div key={label} className="bg-surface border border-line rounded-lg px-4 py-3">
                        <div className="label-caps">{label}</div>
                        <div className={`mono-numbers text-2xl font-semibold mt-1 ${tone ?? 'text-ink'}`}>{value}</div>
                        <div className="text-xs text-muted mt-0.5">{hint}</div>
                    </div>
                ))}
            </div>
        </section>
    );
}
