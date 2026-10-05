'use client';

import {X} from 'lucide-react';
import type {Truck} from '@/lib/types';
import {RECOMMENDATION_LABEL, statusStyle} from '@/lib/status';
import {formatINR, formatINRCompact} from '@/lib/utils/format';
import OptionsTable from './OptionsTable';

const INCIDENT_OPTIONS = [
    ['breakdown', 'Breakdown'], ['flat_tyre', 'Flat tyre'], ['accident', 'Accident'], ['traffic', 'Traffic / jam'],
    ['checkpoint', 'Checkpoint / toll'], ['weather', 'Weather'], ['idling', 'Idling in queue'],
] as const;

const hours = (h?: number) => (h === undefined || h === null ? '—' : `${h.toFixed(1)} h`);

interface Props {
    truck: Truck;
    onClose: () => void;
    onExecute: (truckId: string, incidentId?: string) => void;
    onClassify: (truckId: string, incident: string) => void;
}

/** Everything the engine knows and decided about one truck, and what an operator can do. */
export default function TruckDetail({truck: t, onClose, onExecute, onClassify}: Props) {
    const s = statusStyle(t.status);
    const actionable = (t.recommendation === 'EXECUTE' || t.recommendation === 'CONSIDER') && t.status !== 'resolved';
    const late = (t.slackHours ?? 0) < 0;
    const facts: [string, string, string?][] = [
        ['Speed', `${t.velocity} km/h`],
        ['Distance left', t.remainingKm !== undefined ? `${Math.round(t.remainingKm)} km` : '—'],
        ['Projected arrival', `in ${hours(t.etaHours)}`],
        ['Deadline', t.deadlineHoursLeft === undefined ? '—'
            : t.deadlineHoursLeft >= 0 ? `in ${hours(t.deadlineHoursLeft)}` : `passed ${hours(-t.deadlineHoursLeft)} ago`],
        ['Slack', t.slackHours === undefined ? '—' : late ? `${hours(-t.slackHours)} late` : hours(t.slackHours), late ? 'text-alert' : 'text-clear'],
        ['Money at risk', formatINR(t.exposure ?? 0), (t.exposure ?? 0) > 0 ? 'text-alert' : undefined],
        ['Cargo value', formatINRCompact(t.cargoValue)],
        ['Stopped', t.stopped ? `${Math.round(t.stoppedMinutes ?? 0)} min` : 'No'],
    ];

    return (
        <aside className="fixed inset-y-0 right-0 w-full max-w-2xl z-[1200] bg-surface border-l border-line shadow-xl flex flex-col">
            <header className="px-6 h-16 border-b border-line flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <span className="mono-numbers text-lg font-semibold">{t.id}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${s.chip}`}>{s.label}</span>
                </div>
                <button onClick={onClose} aria-label="Close truck details" className="p-2 rounded-md hover:bg-paper">
                    <X className="w-5 h-5 text-muted"/>
                </button>
            </header>

            <div className="flex-1 overflow-auto p-6 space-y-6">
                <div>
                    <p className="label-caps">{t.driver}{t.client ? ` · ${t.client}` : ''}</p>
                    {t.summary && <p className="text-sm text-ink-2 leading-relaxed mt-2">{t.summary}</p>}
                </div>

                <dl className="grid grid-cols-2 border border-line rounded-lg divide-y divide-line">
                    {facts.map(([label, value, tone], i) => (
                        <div key={label} className={`px-4 py-3 ${i % 2 ? 'border-l border-line' : ''} ${i < 2 ? '!border-t-0' : ''}`}>
                            <dt className="label-caps">{label}</dt>
                            <dd className={`mono-numbers text-sm mt-1 ${tone ?? 'text-ink'}`}>{value}</dd>
                        </div>
                    ))}
                </dl>

                {t.slaHours !== undefined && (
                    <div className="text-sm text-ink-2 bg-paper border border-line rounded-lg px-4 py-3">
                        <span className="label-caps block mb-1">Contract {t.contractId}</span>
                        Deliver within <b>{t.slaHours} h</b> of dispatch ({t.graceMinutes} min grace) · penalty{' '}
                        <b className="mono-numbers">{formatINR(t.penaltyPerHour ?? 0)}/h</b>, capped at{' '}
                        <span className="mono-numbers">{formatINR(t.maxPenalty ?? 0)}</span>
                    </div>
                )}

                {t.stopped && t.incidentId && t.status !== 'resolved' && (
                    <label className="block">
                        <span className="label-caps">Cause of stop (dispatcher)</span>
                        <select className="mt-1 w-full text-sm bg-surface border border-line-strong rounded-md px-3 py-2"
                                value={t.incidentSource === 'dispatcher' ? (t.incident ?? '') : ''}
                                onChange={e => onClassify(t.id, e.target.value)}>
                            <option value="">
                                {t.incidentSource === 'dispatcher' ? 'Unexplained' : `Detected: ${(t.incident || 'unexplained').replace('_', ' ')}`}
                            </option>
                            {INCIDENT_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                    </label>
                )}

                {t.options && t.options.length > 1 && (
                    <div>
                        <h3 className="text-sm font-semibold mb-2">Options compared</h3>
                        <OptionsTable options={t.options} best={t.best} confidence={t.confidence}/>
                    </div>
                )}
            </div>

            <footer className="p-4 border-t border-line shrink-0">
                {actionable ? (
                    <button onClick={() => onExecute(t.id, t.incidentId)}
                            className="w-full py-2.5 rounded-md bg-cobalt hover:bg-cobalt-dark text-white text-sm font-semibold">
                        Approve: {t.best} · saves {formatINR(t.netSavings ?? 0)}
                    </button>
                ) : (
                    <p className="text-sm text-muted text-center">{RECOMMENDATION_LABEL[t.recommendation ?? 'NONE'] ?? t.recommendation}</p>
                )}
            </footer>
        </aside>
    );
}
