'use client';

import {useEffect, useState} from 'react';
import {Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';
import type {ImpactAssumptions, ImpactResult} from '@/lib/hooks/useWebSocket';
import {formatINR, formatINRCompact} from '@/lib/utils/format';

interface Props {
    connected: boolean;
    impact: ImpactResult | null;
    requestImpact: (a: ImpactAssumptions) => void;
}

const DEFAULTS: ImpactAssumptions = {trucks: 100, incidents_per_100_trips: 8, discovery_delay_min: 60};

/**
 * Same incidents, handled two ways: today's manual process vs FleetFusion. Computed by the backend on the
 * real lanes and contracts; every assumption is visible and adjustable.
 */
export default function ImpactPanel({connected, impact, requestImpact}: Props) {
    const [a, setA] = useState<ImpactAssumptions>(DEFAULTS);

    useEffect(() => {
        if (!connected) return;
        const t = setTimeout(() => requestImpact(a), 300);  // debounce slider drags
        return () => clearTimeout(t);
    }, [a, connected, requestImpact]);

    const m = impact?.monthly;
    const pi = impact?.per_incident;
    const chart = pi ? [
        {name: 'Penalties', today: Math.round(pi.today.penalty), ff: Math.round(pi.fleetfusion.penalty)},
        {name: 'Relief spend', today: Math.round(pi.today.relief_spend), ff: Math.round(pi.fleetfusion.relief_spend)},
        {name: 'Total', today: Math.round(pi.today.total_cost), ff: Math.round(pi.fleetfusion.total_cost)},
    ] : [];

    const slider = (key: keyof ImpactAssumptions, label: string, min: number, max: number, step: number, unit: string) => (
        <label className="block">
            <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-300">{label}</span>
                <span className="text-white mono-numbers">{a[key]}{unit}</span>
            </div>
            <input type="range" min={min} max={max} step={step} value={a[key]}
                   onChange={e => setA(prev => ({...prev, [key]: Number(e.target.value)}))}
                   className="w-full accent-teal-500"/>
        </label>
    );

    return (
        <div className="glass-card rounded-2xl p-6 border border-white/10">
            <div className="flex items-start justify-between gap-6 mb-6">
                <div>
                    <h3 className="text-xl font-bold text-white mb-1">Impact: with vs without FleetFusion</h3>
                    <p className="text-sm text-slate-400 max-w-3xl">
                        The same {impact ? impact.assumptions.samples?.toLocaleString('en-IN') : '2,000'} incidents on 16 real lanes,
                        handled two ways. <b className="text-slate-300">Today:</b> the stop is noticed late, carriers are phoned,
                        and the cheapest quote is booked for serious stops. <b className="text-slate-300">FleetFusion:</b> the
                        tracker signal is seen in minutes and the lowest expected-cost option is chosen.
                    </p>
                </div>
                {m && (
                    <div className="text-right shrink-0">
                        <div className="text-xs text-slate-400 uppercase">Saving per month</div>
                        <div className="text-3xl font-bold text-green-400 mono-numbers">{formatINRCompact(m.saving)}</div>
                        <div className="text-xs text-slate-400">{formatINRCompact(impact!.yearly_saving)} per year</div>
                    </div>
                )}
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                <div className="space-y-5">
                    {slider('trucks', 'Fleet size', 10, 1000, 10, ' trucks')}
                    {slider('incidents_per_100_trips', 'Disruptive incidents', 1, 20, 1, ' per 100 trips')}
                    {slider('discovery_delay_min', 'Today, a stop is noticed after', 15, 180, 15, ' min')}
                    <p className="text-xs text-slate-500 leading-relaxed">
                        Assumptions: {a.trucks} trucks × 300 km/day × 26 days on the real lanes (avg {impact?.avg_lane_km ?? '—'} km).
                        Incident rate is an assumption (no public data); try the range. Lanes and the 63% late baseline come from
                        an open dataset of 6,880 real Indian truck trips. Penalty rates are illustrative contract terms.
                    </p>
                </div>

                <div className="lg:col-span-2">
                    {!pi ? (
                        <div className="h-[260px] flex items-center justify-center text-slate-500 text-sm">
                            {connected ? 'Calculating…' : 'Backend offline'}
                        </div>
                    ) : (
                        <>
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={chart} barGap={6}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)"/>
                                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={12}/>
                                    <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={v => formatINRCompact(v)} width={70}/>
                                    <Tooltip contentStyle={{backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, color: '#fff'}}
                                             formatter={(v: number) => formatINR(v)}/>
                                    <Legend wrapperStyle={{color: '#cbd5e1'}}/>
                                    <Bar dataKey="today" name="Today (per incident)" fill="#E8962B" radius={[4, 4, 0, 0]}/>
                                    <Bar dataKey="ff" name="With FleetFusion (per incident)" fill="#2F4FE0" radius={[4, 4, 0, 0]}/>
                                </BarChart>
                            </ResponsiveContainer>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                                {[
                                    ['Cost per incident', `${formatINR(pi.today.total_cost)} → ${formatINR(pi.fleetfusion.total_cost)}`],
                                    ['Late deliveries', `${Math.round(pi.today.late_share * 100)}% → ${Math.round(pi.fleetfusion.late_share * 100)}%`],
                                    ['Relief trucks booked', `${Math.round(pi.today.relief_share * 100)}% → ${Math.round(pi.fleetfusion.relief_share * 100)}%`],
                                    ['Late deliveries avoided', `${m!.late_deliveries_avoided} / month`],
                                ].map(([label, value]) => (
                                    <div key={label} className="rounded-lg border border-white/10 p-3">
                                        <div className="text-xs text-slate-400">{label}</div>
                                        <div className="text-sm text-white mono-numbers mt-1">{value}</div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
