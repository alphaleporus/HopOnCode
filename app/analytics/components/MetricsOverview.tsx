'use client';

import {motion} from 'framer-motion';
import {AlertTriangle, CheckCircle2, IndianRupee, Leaf, RadioTower, ShieldCheck, Truck, Wallet} from 'lucide-react';
import type {FleetMetrics} from '@/lib/hooks/useWebSocket';
import {formatINRCompact} from '@/lib/utils/format';

interface Card {
    label: string;
    value: string;
    hint: string;
    icon: React.ReactNode;
    color: 'teal' | 'green' | 'red' | 'amber' | 'blue' | 'slate';
}

const COLORS: Record<Card['color'], string> = {
    teal: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
    green: 'bg-green-500/10 text-green-400 border-green-500/20',
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    slate: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
};

export default function MetricsOverview({metrics}: { metrics: FleetMetrics | null }) {
    const m = metrics;
    const onTimePct = m && m.trucks ? Math.round(((m.onTime + m.resolved) / m.trucks) * 100) : null;

    const cards: Card[] = [
        {label: 'Net savings', value: formatINRCompact(m?.netSavings ?? 0), hint: 'from executed decisions',
            icon: <IndianRupee className="w-5 h-5"/>, color: 'green'},
        {label: 'Penalties avoided', value: formatINRCompact(m?.penaltiesAvoided ?? 0), hint: 'contract penalties + spoilage',
            icon: <ShieldCheck className="w-5 h-5"/>, color: 'teal'},
        {label: 'Money at risk now', value: formatINRCompact(m?.exposure ?? 0), hint: `${m?.critical ?? 0} critical truck(s)`,
            icon: <AlertTriangle className="w-5 h-5"/>, color: 'red'},
        {label: 'Decisions executed', value: String(m?.decisions ?? 0), hint: `${m?.actionable ?? 0} waiting for review`,
            icon: <CheckCircle2 className="w-5 h-5"/>, color: 'blue'},
        {label: 'Fleet on time', value: onTimePct === null ? '—' : `${onTimePct}%`, hint: `${m?.trucks ?? 0} trucks tracked`,
            icon: <Truck className="w-5 h-5"/>, color: 'teal'},
        {label: 'Relief spend', value: formatINRCompact(m?.reliefSpend ?? 0), hint: 'paid to relief carriers',
            icon: <Wallet className="w-5 h-5"/>, color: 'amber'},
        {label: 'Extra CO₂', value: `${(m?.extraCo2Kg ?? 0).toFixed(0)} kg`, hint: 'relief trucks driving to pickup',
            icon: <Leaf className="w-5 h-5"/>, color: 'green'},
        {label: 'Trackers silent', value: String(m?.signalLost ?? 0), hint: 'no data recently',
            icon: <RadioTower className="w-5 h-5"/>, color: 'slate'},
    ];

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map((c, i) => (
                <motion.div
                    key={c.label}
                    initial={{opacity: 0, y: 12}}
                    animate={{opacity: 1, y: 0}}
                    transition={{delay: i * 0.04}}
                    className="glass-card rounded-2xl p-5 border border-white/10"
                >
                    <div className={`inline-flex p-2 rounded-lg border mb-3 ${COLORS[c.color]}`}>{c.icon}</div>
                    <div className="text-2xl font-bold text-white mono-numbers">{c.value}</div>
                    <div className="text-sm text-slate-300 mt-1">{c.label}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{c.hint}</div>
                </motion.div>
            ))}
        </div>
    );
}
