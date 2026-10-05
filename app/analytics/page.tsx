'use client';

import {FileJson, FileText} from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import {useWebSocket} from '@/lib/hooks/useWebSocket';
import {formatINR} from '@/lib/utils/format';
import MetricsOverview from './components/MetricsOverview';
import SavingsChart from './components/SavingsChart';
import TruckStatusChart from './components/TruckStatusChart';
import DecisionLog from './components/DecisionLog';
import ImpactPanel from './components/ImpactPanel';

function download(content: string, filename: string, type: string) {
    const url = URL.createObjectURL(new Blob([content], {type}));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

const csvCell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export default function AnalyticsPage() {
    const {trucks, metrics, decisions, connected, impact, requestImpact} = useWebSocket();

    // Trucks with money at stake right now, biggest first
    const atRisk = trucks
        .filter(t => (t.exposure ?? 0) > 0 && t.status !== 'resolved')
        .sort((a, b) => (b.exposure ?? 0) - (a.exposure ?? 0))
        .slice(0, 6);

    const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

    const exportJSON = () => {
        const data = {exportedAt: new Date().toISOString(), currency: 'INR', metrics, decisions,
            trucks: trucks.map(t => ({id: t.id, status: t.status, incident: t.incident, exposure: t.exposure,
                contractId: t.contractId}))};
        download(JSON.stringify(data, null, 2), `fleetfusion-${stamp()}.json`, 'application/json');
    };

    const exportCSV = () => {
        const header = ['time', 'truck', 'contract', 'problem', 'decision', 'at_risk_inr', 'paid_inr', 'saved_inr',
            'penalty_avoided_inr', 'extra_co2_kg'];
        const rows = decisions.map(d => [d.time, d.truckId, d.contractId, d.incident || 'unexplained stop',
            d.action === 'execute' ? d.option : 'Ignored', d.exposure, d.cost, d.netSavings, d.penaltyAvoided, d.extraCo2Kg]);
        download([header, ...rows].map(r => r.map(csvCell).join(',')).join('\n'),
            `fleetfusion-decisions-${stamp()}.csv`, 'text/csv');
    };

    return (
        <AppShell active="analytics" title="Impact & analytics"
                  subtitle="What FleetFusion saves, and what is at risk right now"
                  connected={connected}
                  actions={
                      <div className="flex items-center gap-2">
                          <button onClick={exportCSV} disabled={decisions.length === 0}
                                  className="btn-ghost px-3 py-1.5 rounded-md text-sm flex items-center gap-2 disabled:opacity-40">
                              <FileText className="w-4 h-4"/>Decisions CSV
                          </button>
                          <button onClick={exportJSON} className="btn-primary px-3 py-1.5 rounded-md text-sm flex items-center gap-2">
                              <FileJson className="w-4 h-4"/>Full export
                          </button>
                      </div>
                  }>
            <div className="p-4 space-y-4 max-w-[1600px] mx-auto">
                <ImpactPanel connected={connected} impact={impact} requestImpact={requestImpact}/>
                <MetricsOverview metrics={metrics}/>
                <div className="grid lg:grid-cols-2 gap-4">
                    <SavingsChart decisions={decisions}/>
                    <TruckStatusChart metrics={metrics}/>
                </div>
                <section className="bg-surface border border-line rounded-lg">
                    <header className="px-4 py-3 border-b border-line flex items-baseline justify-between">
                        <h2 className="text-sm font-semibold">Money at risk by truck</h2>
                        <span className="label-caps">Penalty and spoilage if nothing is done</span>
                    </header>
                    {atRisk.length === 0 ? (
                        <div className="p-6 text-sm text-muted text-center">Nothing at risk right now.</div>
                    ) : (
                        <ul className="divide-y divide-line">
                            {atRisk.map(t => (
                                <li key={t.id} className="px-4 py-3 flex items-center justify-between gap-4">
                                    <div className="min-w-0">
                                        <div className="mono-numbers text-sm font-semibold">{t.id}</div>
                                        <div className="text-xs text-muted truncate">{t.summary}</div>
                                    </div>
                                    <span className="mono-numbers text-sm font-semibold text-alert shrink-0">{formatINR(t.exposure ?? 0)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
                <DecisionLog decisions={decisions}/>
            </div>
        </AppShell>
    );
}
