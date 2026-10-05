'use client';

import {Truck} from '@/lib/types';

// Incident types a dispatcher can assign (the placeholder option clears back to "unexplained")
const INCIDENT_OPTIONS: { value: string; label: string }[] = [
    {value: 'breakdown', label: 'Breakdown'},
    {value: 'flat_tyre', label: 'Flat tyre'},
    {value: 'accident', label: 'Accident'},
    {value: 'traffic', label: 'Traffic / jam'},
    {value: 'checkpoint', label: 'Checkpoint / toll'},
    {value: 'weather', label: 'Weather'},
    {value: 'idling', label: 'Idling in queue'},
];

const SOURCE_LABEL: Record<string, string> = {
    telematics: 'from telematics',
    dispatcher: 'set by dispatcher',
    '': 'no signal yet',
};

interface Props {
    trucks: Truck[];
    onClassify: (truckId: string, incident: string) => void;
}

/**
 * Office-side triage of stopped or silent trucks. The driver never has to do anything:
 * causes are inferred from machine signals, and a trained dispatcher can correct them.
 */
export default function DispatcherDesk({trucks, onClassify}: Props) {
    const attention = trucks.filter(t => t.stopped || t.status === 'signal-lost');

    return (
        <div>
            <div className="text-xs text-slate-500 uppercase mb-2">Dispatcher desk</div>
            {attention.length === 0 ? (
                <div className="text-xs text-slate-500">No stopped or silent trucks.</div>
            ) : (
                <div className="space-y-2">
                    {attention.map(t => {
                        const lost = t.status === 'signal-lost';
                        return (
                            <div key={t.id} className="glass-card p-3 rounded-lg">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-semibold text-white mono-numbers">{t.id}</span>
                                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                                        lost ? 'bg-slate-500/20 text-slate-300' :
                                            t.status === 'critical' ? 'bg-red-500/20 text-red-300' :
                                                t.status === 'resolved' ? 'bg-purple-500/20 text-purple-300' :
                                                    'bg-amber-500/20 text-amber-300'
                                    }`}>{t.status.toUpperCase().replace('-', ' ')}</span>
                                </div>
                                <div className="text-xs text-slate-400 mb-2">
                                    {lost
                                        ? `No tracker data for ${t.silentMinutes ?? 0} min`
                                        : `Stopped ${Math.round(t.stoppedMinutes ?? 0)} min · ${
                                            (t.incident || 'unexplained').replace('_', ' ')} (${SOURCE_LABEL[t.incidentSource ?? '']})`}
                                </div>
                                {!lost && t.incidentId && t.status !== 'resolved' && (
                                    <select
                                        aria-label={`Classify stop for ${t.id}`}
                                        className="w-full text-xs bg-slate-900/60 border border-white/10 rounded px-2 py-1 text-slate-200"
                                        value={t.incidentSource === 'dispatcher' ? (t.incident ?? '') : ''}
                                        onChange={e => onClassify(t.id, e.target.value)}
                                    >
                                        <option value="" disabled={t.incidentSource !== 'dispatcher'}>
                                            {t.incidentSource === 'dispatcher' ? 'Unexplained' : 'Classify stop…'}
                                        </option>
                                        {INCIDENT_OPTIONS.map(o => (
                                            <option key={o.value} value={o.value}>{o.label}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
