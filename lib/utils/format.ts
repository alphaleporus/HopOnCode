// Indian digit grouping: ₹1,25,000 / ₹1,00,00,000
const inr = new Intl.NumberFormat('en-IN', {style: 'currency', currency: 'INR', maximumFractionDigits: 0});

export function formatINR(amount: number): string {
    return inr.format(amount);
}
