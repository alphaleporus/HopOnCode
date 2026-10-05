'use client';

import {useState} from 'react';
import dynamic from 'next/dynamic';
import {AnimatePresence} from 'framer-motion';
import AppShell from '@/components/layout/AppShell';
import AgentOverlay from '@/components/dashboard/AgentOverlay';
import FinancialModal from '@/components/dashboard/FinancialModal';
import IncidentInbox from '@/components/dashboard/IncidentInbox';
import TruckDetail from '@/components/dashboard/TruckDetail';
import {useWebSocket} from '@/lib/hooks/useWebSocket';
import {formatINRCompact} from '@/lib/utils/format';

// Leaflet needs the browser
const SupplyChainMap = dynamic(() => import('@/components/SupplyChainMap'), {
    ssr: false,
    loading: () => <div className="h-full flex items-center justify-center text-sm text-muted">Loading map…</div>,
});

function Kpi({label, value, tone, hint}: { label: string; value: string; tone?: string; hint?: string }) {
    return (
        <div className="bg-surface border border-line rounded-lg px-4 py-3">
            <div className="label-caps">{label}</div>
            <div className={`mono-numbers text-2xl font-semibold mt-1 ${tone ?? 'text-ink'}`}>{value}</div>
            {hint && <div className="text-xs text-muted mt-0.5">{hint}</div>}
        </div>
    );
}

export default function DashboardPage() {
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const {
        trucks, events, arbitrageOpportunity, executeArbitrage, dismissArbitrage, connected, error, metrics,
        classifyIncident, setAiEnabled, demoControl, executeDecision,
    } = useWebSocket();
    const selected = trucks.find(t => t.id === selectedId) ?? null;

    const onTimePct = metrics && metrics.trucks ? Math.round(((metrics.onTime + metrics.resolved) / metrics.trucks) * 100) : null;
    const needsDecision = trucks.filter(t => t.recommendation === 'EXECUTE' || t.recommendation === 'CONSIDER').length;

    const aiSwitch = (
        <div className="flex items-center justify-between gap-2">
            <div>
                <div className="text-xs font-medium">AI explanations</div>
                <div className="text-[11px] text-muted">
                    {!metrics?.aiAvailable ? 'No local model' : metrics.aiEnabled ? 'On' : 'Off'} · decisions unchanged
                </div>
            </div>
            <button aria-label="Toggle AI explanations" disabled={!metrics?.aiAvailable}
                    onClick={() => setAiEnabled(!metrics?.aiEnabled)}
                    className={`relative w-9 h-5 rounded-full transition-colors disabled:opacity-40 ${metrics?.aiEnabled ? 'bg-cobalt' : 'bg-line-strong'}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${metrics?.aiEnabled ? 'translate-x-4' : ''}`}/>
            </button>
        </div>
    );

    const demoButtons = metrics?.demoControls ? (
        <div className="flex items-center gap-1 border border-line rounded-md px-1 py-1">
            <span className="label-caps px-1">Demo</span>
            <button onClick={() => demoControl('breakdown')} className="text-xs px-2 py-1 rounded hover:bg-paper">Breakdown</button>
            <button onClick={() => demoControl('reset')} className="text-xs px-2 py-1 rounded hover:bg-paper">Reset</button>
        </div>
    ) : null;

    return (
        <AppShell active="dashboard" title="Operations"
                  subtitle={`${trucks.length} trucks · South India network${error && !connected ? ` · ${error}` : ''}`}
                  connected={connected} actions={demoButtons} sidebarFooter={aiSwitch}>
            <div className="h-full p-4 flex flex-col gap-4 min-h-[720px]">
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 shrink-0">
                    <Kpi label="Trucks tracked" value={String(trucks.length)} hint={`${metrics?.signalLost ?? 0} without signal`}/>
                    <Kpi label="On time" value={onTimePct === null ? '—' : `${onTimePct}%`} tone="text-clear"/>
                    <Kpi label="Money at risk now" value={formatINRCompact(metrics?.exposure ?? 0)} tone="text-alert"
                         hint={`${metrics?.critical ?? 0} critical`}/>
                    <Kpi label="Saved this session" value={formatINRCompact(metrics?.netSavings ?? 0)} tone="text-clear"
                         hint={`${metrics?.decisions ?? 0} decisions executed`}/>
                    <Kpi label="Decisions waiting" value={String(needsDecision)} tone={needsDecision ? 'text-cobalt' : 'text-ink'}/>
                </div>

                <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-12 gap-4">
                    <div className="xl:col-span-5 min-h-0 flex flex-col">
                        <IncidentInbox trucks={trucks} selectedId={selectedId} onSelect={setSelectedId}/>
                    </div>
                    <div className="xl:col-span-7 min-h-0 grid grid-rows-[3fr_2fr] gap-4">
                        <div className="relative bg-surface border border-line rounded-lg overflow-hidden min-h-[320px]">
                            <SupplyChainMap trucks={trucks} ecoMode={false} onSelect={setSelectedId} selectedId={selectedId}/>
                        </div>
                        <AgentOverlay events={events}/>
                    </div>
                </div>
            </div>

            {selected && (
                <TruckDetail truck={selected} onClose={() => setSelectedId(null)}
                             onExecute={(id, incidentId) => executeDecision(id, incidentId)}
                             onClassify={classifyIncident}/>
            )}

            <AnimatePresence>
                {arbitrageOpportunity && !selected && (
                    <FinancialModal opportunity={arbitrageOpportunity} onExecute={executeArbitrage} onDismiss={dismissArbitrage}/>
                )}
            </AnimatePresence>
        </AppShell>
    );
}
