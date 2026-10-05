'use client';

import type {AgentEvent} from '@/lib/types';

const SEVERITY_DOT: Record<string, string> = {critical: 'bg-alert', warning: 'bg-signal', info: 'bg-lost'};

// Strip emoji: the brand voice is calm and numbers-first
const clean = (m: string) => m.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '').replace(/\s+/g, ' ').trim();

/** Activity log: what the engine noticed and decided, newest first. */
export default function AgentOverlay({events}: { events: AgentEvent[] }) {
    return (
        <section className="bg-surface border border-line rounded-lg flex flex-col min-h-0">
            <header className="px-4 py-3 border-b border-line flex items-baseline justify-between">
                <h2 className="text-sm font-semibold">Activity</h2>
                <span className="label-caps">{events.length} events</span>
            </header>
            {events.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted">Waiting for events…</div>
            ) : (
                <ul className="overflow-auto divide-y divide-line">
                    {events.map(e => (
                        <li key={e.id} className="px-4 py-2 grid grid-cols-[auto_1fr_auto] gap-3 items-baseline">
                            <span className={`w-1.5 h-1.5 rounded-full translate-y-[-2px] ${SEVERITY_DOT[e.severity] ?? 'bg-lost'}`}/>
                            <span className="text-sm text-ink-2">{clean(e.message)}</span>
                            <span className="mono-numbers text-[11px] text-muted">
                                {new Date(e.timestamp).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit'})}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
