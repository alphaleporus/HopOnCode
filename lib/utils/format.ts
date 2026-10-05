// Indian digit grouping: ₹1,25,000 / ₹1,00,00,000
const inr = new Intl.NumberFormat('en-IN', {style: 'currency', currency: 'INR', maximumFractionDigits: 0});

export function formatINR(amount: number): string {
    return inr.format(amount);
}

// Compact Indian units for tight spaces: ₹2.5 Cr, ₹38.3 L, ₹22,516
export function formatINRCompact(amount: number): string {
    const abs = Math.abs(amount);
    if (abs >= 1e7) return `₹${(amount / 1e7).toFixed(abs >= 1e8 ? 0 : 1)} Cr`;
    if (abs >= 1e5) return `₹${(amount / 1e5).toFixed(1)} L`;
    return formatINR(amount);
}
