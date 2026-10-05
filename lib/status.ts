// One place for status colours (brand: Clear = on time, Signal = late, Alert = critical, Cobalt = resolved).
export const STATUS = {
    'on-time': {label: 'On time', hex: '#1F9461', chip: 'bg-clear/10 text-clear', dot: 'bg-clear'},
    delayed: {label: 'Delayed', hex: '#E8962B', chip: 'bg-signal/15 text-[#9A5B10]', dot: 'bg-signal'},
    critical: {label: 'Critical', hex: '#C2410C', chip: 'bg-alert/10 text-alert', dot: 'bg-alert'},
    resolved: {label: 'Resolved', hex: '#2F4FE0', chip: 'bg-cobalt/10 text-cobalt', dot: 'bg-cobalt'},
    'signal-lost': {label: 'Signal lost', hex: '#8A8F99', chip: 'bg-lost/15 text-ink-2', dot: 'bg-lost'},
} as const;

export type StatusKey = keyof typeof STATUS;

export function statusStyle(status: string) {
    return STATUS[(status in STATUS ? status : 'on-time') as StatusKey];
}

export const RECOMMENDATION_LABEL: Record<string, string> = {
    EXECUTE: 'Approve relief',
    CONSIDER: 'Review relief',
    MONITOR: 'Monitor',
    RESOLVED: 'Relief dispatched',
    CHECK_TRACKER: 'Check tracker',
    NONE: '—',
};
