'use client';

import Link from 'next/link';
import Image from 'next/image';
import {motion} from 'framer-motion';
import {BarChart3, FileJson, FileText, Home} from 'lucide-react';
import UserMenu from '@/components/dashboard/UserMenu';
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
        <div className="h-screen w-screen overflow-hidden gradient-bg">
            {/* Sidebar */}
            <div className="fixed left-0 top-0 h-full w-72 glass-card border-r border-white/10 z-40 p-6">
                <Link href="/" className="flex items-center gap-2 mb-8">
                    <div className="relative w-40 h-10">
                        <Image src="/Logo.png" alt="FleetFusion Logo" width={160} height={40} className="object-contain"/>
                    </div>
                </Link>
                <nav className="space-y-2">
                    <Link href="/dashboard">
                        <div className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/5 text-slate-300 hover:text-white transition-colors">
                            <Home className="w-5 h-5"/><span className="font-medium">Dashboard</span>
                        </div>
                    </Link>
                    <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400">
                        <BarChart3 className="w-5 h-5"/><span className="font-medium">Analytics</span>
                    </div>
                </nav>
                <div className="absolute bottom-6 left-6 right-6">
                    <div className="glass-card p-4 rounded-lg">
                        <div className="text-xs text-slate-500 uppercase mb-2">Data</div>
                        <div className="flex items-center gap-2">
                            <motion.div animate={{scale: [1, 1.2, 1], opacity: [1, 0.5, 1]}} transition={{duration: 2, repeat: Infinity}}
                                        className={`w-2 h-2 rounded-full ${connected ? 'bg-teal-500' : 'bg-red-500'}`}/>
                            <span className={`text-sm font-semibold ${connected ? 'text-teal-400' : 'text-red-400'}`}>
                                {connected ? 'Live' : 'Backend offline'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main */}
            <div className="ml-72 flex flex-col h-full overflow-hidden">
                <div className="glass-nav border-b border-white/10 px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-xl font-bold text-white">Analytics</h1>
                            <p className="text-sm text-slate-400">What the decision engine has saved, and what is at risk right now</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={exportCSV} disabled={decisions.length === 0}
                                    className="btn-ghost px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-40">
                                <FileText className="w-4 h-4"/><span className="text-sm font-medium text-white">Decisions CSV</span>
                            </button>
                            <button onClick={exportJSON} className="btn-primary px-4 py-2 rounded-lg flex items-center gap-2">
                                <FileJson className="w-4 h-4"/><span className="text-sm font-medium">Full export</span>
                            </button>
                            <UserMenu/>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    <div className="max-w-[1600px] mx-auto space-y-6">
                        <ImpactPanel connected={connected} impact={impact} requestImpact={requestImpact}/>

                        <MetricsOverview metrics={metrics}/>

                        <div className="grid lg:grid-cols-2 gap-6">
                            <SavingsChart decisions={decisions}/>
                            <TruckStatusChart metrics={metrics}/>
                        </div>

                        <div className="glass-card rounded-2xl p-6 border border-white/10">
                            <h3 className="text-xl font-bold text-white mb-1">Money at risk by truck</h3>
                            <p className="text-sm text-slate-400 mb-4">Projected penalty and spoilage if nothing is done</p>
                            {atRisk.length === 0 ? (
                                <div className="text-sm text-slate-500 py-4 text-center">Nothing at risk right now.</div>
                            ) : (
                                <div className="space-y-3">
                                    {atRisk.map(t => (
                                        <div key={t.id} className="flex items-center justify-between gap-4">
                                            <div className="min-w-0">
                                                <div className="text-white text-sm mono-numbers">{t.id}</div>
                                                <div className="text-xs text-slate-400 truncate">{t.summary}</div>
                                            </div>
                                            <span className="text-red-300 font-semibold mono-numbers shrink-0">{formatINR(t.exposure ?? 0)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <DecisionLog decisions={decisions}/>
                    </div>
                </div>
            </div>
        </div>
    );
}
