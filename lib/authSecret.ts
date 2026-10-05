// Dev-only fallback so the demo runs without .env.local; production must set NEXTAUTH_SECRET.
// Kept separate from lib/auth.ts so middleware (Edge runtime) doesn't import NextAuth providers.
export const AUTH_SECRET =
    process.env.NEXTAUTH_SECRET ||
    (process.env.NODE_ENV !== 'production' ? 'dev-only-insecure-secret' : undefined);
