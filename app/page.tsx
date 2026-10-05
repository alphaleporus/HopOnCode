import Image from 'next/image';
import Link from 'next/link';
import {ArrowRight, Calculator, Gauge, Radio, Stethoscope} from 'lucide-react';

const STATS = [
    {value: '₹24 L Cr', label: 'India’s yearly logistics cost (7.97% of GDP)', source: 'DPIIT–NCAER, FY24'},
    {value: '5–25%', label: 'of a truck’s journey time lost to stoppages', source: 'TCI–IIM highway study'},
    {value: '63%', label: 'of 6,880 real Indian truck trips arrived late', source: 'Open dataset, CC BY-SA'},
    {value: '0', label: 'actions needed from the driver', source: 'Machine signals only'},
];

const STEPS = [
    {icon: Radio, title: 'Detect', text: 'Reads the GPS tracker every truck already carries. A stop or a silent tracker is flagged in seconds.'},
    {icon: Stethoscope, title: 'Diagnose', text: 'Works out why it stopped from engine fault codes, crash alarms and ignition. Dispatchers can correct it.'},
    {icon: Calculator, title: 'Price', text: 'Projects arrival against the contract deadline, grace period, penalty cap and cold-chain limits.'},
    {icon: Gauge, title: 'Decide', text: 'Compares waiting against every relief carrier by expected cost, and recommends the cheapest fix.'},
];

const INTEGRATIONS = [
    {name: 'Traccar / AIS-140 trackers', state: 'Live in demo'},
    {name: 'HTTP API + decision webhooks', state: 'Live in demo'},
    {name: 'SAP Track & Trace', state: 'Next connector'},
    {name: 'Fleet telematics platforms', state: 'Next connector'},
];

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-paper text-ink">
            <header className="bg-surface border-b border-line">
                <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
                    <Image src="/brand/logo/logo-primary.svg" alt="Fleet Fusion" width={150} height={32} priority/>
                    <nav className="flex items-center gap-6 text-sm">
                        <a href="#how" className="text-ink-2 hover:text-cobalt">How it works</a>
                        <a href="#impact" className="text-ink-2 hover:text-cobalt">Impact</a>
                        <Link href="/login" className="btn-ghost px-3 py-1.5 rounded-md">Log in</Link>
                        <Link href="/dashboard" className="btn-primary px-3 py-1.5 rounded-md flex items-center gap-1.5">
                            Open live demo <ArrowRight className="w-4 h-4"/>
                        </Link>
                    </nav>
                </div>
            </header>

            <main>
                <section className="max-w-6xl mx-auto px-6 py-16 grid lg:grid-cols-2 gap-12 items-center">
                    <div>
                        <p className="label-caps !text-cobalt">Delay decision engine for road freight</p>
                        <h1 className="text-4xl lg:text-5xl font-semibold leading-tight mt-3">
                            Know what a late truck will cost, and the cheapest fix, in seconds.
                        </h1>
                        <p className="text-lg text-ink-2 mt-5 leading-relaxed">
                            FleetFusion reads the trackers your trucks already carry, prices each delay against the customer’s
                            contract, and recommends the cheapest recovery. It plugs into the systems you already run.
                            No driver app. No AI dependency.
                        </p>
                        <div className="flex gap-3 mt-8">
                            <Link href="/dashboard" className="btn-primary px-5 py-2.5 rounded-md flex items-center gap-2">
                                Open live demo <ArrowRight className="w-4 h-4"/>
                            </Link>
                            <Link href="/analytics" className="btn-ghost px-5 py-2.5 rounded-md">See the impact</Link>
                        </div>
                    </div>
                    <div className="bg-surface border border-line rounded-lg p-2 shadow-sm">
                        <Image src="/fleetfusion-decision.jpg" alt="FleetFusion operations dashboard" width={1600} height={1000}
                               className="rounded-md w-full h-auto" priority/>
                    </div>
                </section>

                <section className="border-y border-line bg-surface">
                    <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-2 lg:grid-cols-4 gap-8">
                        {STATS.map(s => (
                            <div key={s.label}>
                                <div className="mono-numbers text-3xl font-semibold text-cobalt">{s.value}</div>
                                <div className="text-sm text-ink-2 mt-2">{s.label}</div>
                                <div className="label-caps mt-1">{s.source}</div>
                            </div>
                        ))}
                    </div>
                </section>

                <section id="how" className="max-w-6xl mx-auto px-6 py-16">
                    <h2 className="text-2xl font-semibold">How it works</h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
                        {STEPS.map(({icon: Icon, title, text}, i) => (
                            <div key={title} className="bg-surface border border-line rounded-lg p-5">
                                <div className="flex items-center gap-2">
                                    <span className="label-caps">0{i + 1}</span>
                                    <Icon className="w-4 h-4 text-cobalt"/>
                                </div>
                                <h3 className="font-semibold mt-3">{title}</h3>
                                <p className="text-sm text-ink-2 mt-2 leading-relaxed">{text}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <section id="impact" className="max-w-6xl mx-auto px-6 pb-16 grid lg:grid-cols-2 gap-6">
                    <div className="bg-surface border border-line rounded-lg p-6">
                        <p className="label-caps">Impact, same incidents handled two ways</p>
                        <div className="mono-numbers text-4xl font-semibold text-clear mt-3">≈ ₹9 L / month</div>
                        <p className="text-sm text-ink-2 mt-1">per 100 trucks, middle case (₹3–16 L across our assumption range)</p>
                        <ul className="text-sm text-ink-2 mt-5 space-y-1.5">
                            <li>Cost per incident <span className="mono-numbers">₹7,705 → ₹3,639</span></li>
                            <li>Incidents ending in a late delivery <span className="mono-numbers">24% → 12%</span></li>
                            <li>Relief trucks booked <span className="mono-numbers">29% → 14%</span>: fewer bookings, less CO₂</li>
                        </ul>
                        <Link href="/analytics" className="inline-flex items-center gap-1.5 text-sm text-cobalt font-medium mt-5">
                            Adjust the assumptions <ArrowRight className="w-4 h-4"/>
                        </Link>
                    </div>
                    <div className="bg-surface border border-line rounded-lg p-6">
                        <p className="label-caps">Plugs into what you already run</p>
                        <ul className="mt-4 divide-y divide-line">
                            {INTEGRATIONS.map(i => (
                                <li key={i.name} className="py-3 flex items-center justify-between">
                                    <span className="text-sm">{i.name}</span>
                                    <span className={`text-xs px-2 py-0.5 rounded ${i.state === 'Live in demo' ? 'bg-clear/10 text-clear' : 'bg-mist text-cobalt'}`}>{i.state}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>
            </main>

            <footer className="border-t border-line bg-surface">
                <div className="max-w-6xl mx-auto px-6 py-6 flex justify-between text-xs text-muted">
                    <span>© 2026 Fleet Fusion · Craftverse 2.0</span>
                    <span>Free and open-source stack · Penalty rates in the demo are illustrative</span>
                </div>
            </footer>
        </div>
    );
}
