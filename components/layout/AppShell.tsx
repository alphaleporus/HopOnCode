'use client';

import Image from 'next/image';
import Link from 'next/link';
import {BarChart3, LayoutDashboard} from 'lucide-react';
import UserMenu from '@/components/dashboard/UserMenu';

interface Props {
    active: 'dashboard' | 'analytics';
    title: string;
    subtitle?: string;
    connected: boolean;
    actions?: React.ReactNode;       // right side of the top bar
    sidebarFooter?: React.ReactNode; // e.g. AI explanations switch
    children: React.ReactNode;
}

const NAV = [
    {key: 'dashboard', href: '/dashboard', label: 'Operations', icon: LayoutDashboard},
    {key: 'analytics', href: '/analytics', label: 'Impact & analytics', icon: BarChart3},
] as const;

/** Shared frame for signed-in pages: brand sidebar, top bar, content area. */
export default function AppShell({active, title, subtitle, connected, actions, sidebarFooter, children}: Props) {
    return (
        <div className="h-screen w-screen overflow-hidden bg-paper text-ink flex">
            <aside className="w-60 shrink-0 bg-surface border-r border-line flex flex-col">
                <Link href="/" className="px-5 h-16 flex items-center border-b border-line">
                    <Image src="/brand/logo/logo-primary.svg" alt="Fleet Fusion" width={150} height={32} priority/>
                </Link>
                <nav className="p-3 space-y-1">
                    {NAV.map(({key, href, label, icon: Icon}) => (
                        <Link key={key} href={href}
                              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                                  active === key ? 'bg-mist text-cobalt' : 'text-ink-2 hover:bg-paper'}`}>
                            <Icon className="w-4 h-4"/>{label}
                        </Link>
                    ))}
                </nav>
                <div className="mt-auto p-4 border-t border-line space-y-3">
                    <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${connected ? 'bg-clear' : 'bg-alert'}`}/>
                        <span className="label-caps">{connected ? 'Live' : 'Offline'}</span>
                    </div>
                    {sidebarFooter}
                </div>
            </aside>

            <div className="flex-1 min-w-0 flex flex-col">
                <header className="h-16 shrink-0 bg-surface border-b border-line px-6 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                        <h1 className="text-lg font-semibold leading-tight">{title}</h1>
                        {subtitle && <p className="text-xs text-muted truncate">{subtitle}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                        {actions}
                        <UserMenu/>
                    </div>
                </header>
                <main className="flex-1 min-h-0 overflow-auto">{children}</main>
            </div>
        </div>
    );
}
