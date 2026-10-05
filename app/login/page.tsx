'use client';

import {useState} from 'react';
import {signIn} from 'next-auth/react';
import {useRouter} from 'next/navigation';
import {motion} from 'framer-motion';
import {Mail, Lock, AlertCircle, Loader2} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const result = await signIn('credentials', {
                email,
                password,
                redirect: false,
            });

            if (result?.error) {
                setError(result.error);
            } else if (result?.ok) {
                // Get the callback URL from query params, default to dashboard
                const urlParams = new URLSearchParams(window.location.search);
                // Only follow same-origin relative paths (prevents open redirect via ?callbackUrl=)
                const raw = urlParams.get('callbackUrl');
                const callbackUrl = raw && raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/\\')
                    ? raw
                    : '/dashboard';
                router.push(callbackUrl);
                router.refresh();
            }
        } catch {
            setError('An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
            <div className="absolute inset-0 grid-pattern opacity-30"/>

            <motion.div
                initial={{opacity: 0, y: 20}}
                animate={{opacity: 1, y: 0}}
                className="relative z-10 w-full max-w-md"
            >
                {/* Logo */}
                <motion.div
                    initial={{opacity: 0, y: -20}}
                    animate={{opacity: 1, y: 0}}
                    className="text-center mb-8"
                >
                    <Link href="/" className="inline-flex items-center gap-2 mb-2">
                        <div className="relative w-56 h-14">
                            <Image 
                                src="/brand/logo/logo-primary.svg" 
                                alt="FleetFusion Logo" 
                                width={224} 
                                height={56}
                                className="object-contain"
                            />
                        </div>
                    </Link>
                </motion.div>

                {/* Login Card */}
                <div className="glass-card rounded-3xl p-8 border border-line">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-ink mb-2">Welcome Back</h1>
                        <p className="text-muted">Sign in to access your dashboard</p>
                    </div>

                    {error && (
                        <motion.div
                            initial={{opacity: 0, y: -10}}
                            animate={{opacity: 1, y: 0}}
                            className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-3"
                        >
                            <AlertCircle className="w-5 h-5 text-alert mt-0.5 flex-shrink-0"/>
                            <p className="text-sm text-alert">{error}</p>
                        </motion.div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-ink-2 mb-2">
                                Email Address
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted"/>
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="w-full pl-11 pr-4 py-3 rounded-lg bg-paper border border-line text-ink placeholder-slate-500 focus:border-line focus:ring-2 focus:ring-teal-500/20 transition-all outline-none"
                                    placeholder="you@example.com"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-ink-2 mb-2">
                                Password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted"/>
                                <input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="w-full pl-11 pr-4 py-3 rounded-lg bg-paper border border-line text-ink placeholder-slate-500 focus:border-line focus:ring-2 focus:ring-teal-500/20 transition-all outline-none"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full btn-primary py-3 rounded-lg font-semibold text-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin"/>
                                    Signing in...
                                </>
                            ) : (
                                'Sign In'
                            )}
                        </button>
                    </form>

                    {/* Demo Credentials */}
                    <div className="mt-6 p-4 rounded-lg bg-cobalt/5 border border-line">
                        <p className="text-sm font-semibold text-cobalt mb-2">Demo Credentials:</p>
                        <div className="space-y-1 text-xs text-muted">
                            <p>Email: <span className="text-ink mono-numbers">demo@fleetfusion.com</span></p>
                            <p>Password: <span className="text-ink mono-numbers">demo123</span></p>
                        </div>
                    </div>

                    <div className="mt-6 text-center">
                        <Link href="/" className="text-sm text-muted hover:text-cobalt transition-colors">
                            ← Back to Home
                        </Link>
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center text-sm text-muted mt-8">
                    &copy; 2026 FleetFusion. All rights reserved.
                </p>
            </motion.div>
        </div>
    );
}
