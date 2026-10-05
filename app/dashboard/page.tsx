'use client';

import { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Leaf, BarChart3 } from 'lucide-react';
import { useWebSocket } from '@/lib/hooks/useWebSocket';
import AgentOverlay from '@/components/dashboard/AgentOverlay';
import FinancialModal from '@/components/dashboard/FinancialModal';
import UserMenu from '@/components/dashboard/UserMenu';
import Image from 'next/image';

// Dynamic import for map component (Leaflet requires window object)
const SupplyChainMap = dynamic(() => import('@/components/SupplyChainMap'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 rounded-2xl overflow-hidden">
      <div className="text-center">
        <div className="text-6xl mb-4 animate-pulse">🗺️</div>
        <h3 className="text-2xl font-bold text-white mb-2">Loading Map...</h3>
        <p className="text-slate-400">Initializing real-time tracking</p>
        <div className="mt-4 flex items-center justify-center gap-2">
          <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
    </div>
  )
});

export default function DashboardPage() {
  const [ecoRouteEnabled, setEcoRouteEnabled] = useState(false);
  const { trucks, events, arbitrageOpportunity, executeArbitrage, dismissArbitrage, connected, error } = useWebSocket();

  // Calculate total cargo value
  const totalCargoValue = trucks.reduce((sum, truck) => sum + truck.cargoValue, 0);

  return (
    <div className="h-screen w-screen overflow-hidden gradient-bg">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-full w-72 glass-card border-r border-white/10 z-40 p-6">
        <Link href="/" className="flex items-center gap-2 mb-8">
          <div className="relative w-40 h-10">
            <Image 
              src="/Logo.png" 
              alt="FleetFusion Logo" 
              width={160} 
              height={40}
              className="object-contain"
            />
          </div>
        </Link>
        <nav className="space-y-2">
          <Link href="/dashboard"><div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400"><Home className="w-5 h-5" /><span className="font-medium">Dashboard</span></div></Link>
            <Link href="/analytics">
                <div
                    className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/5 text-slate-300 hover:text-white transition-colors">
                    <BarChart3 className="w-5 h-5"/><span className="font-medium">Analytics</span></div></Link>
        </nav>
        <div className="absolute bottom-6 left-6 right-6">
          <div className="glass-card p-4 rounded-lg">
            <div className="text-xs text-slate-500 uppercase mb-2">System Status</div>
            <div className="flex items-center gap-2">
              <motion.div animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }} transition={{ duration: 2, repeat: Infinity }} className={`w-2 h-2 rounded-full ${connected ? 'bg-teal-500' : 'bg-red-500'}`} />
              <span className={`text-sm font-semibold mono-numbers ${connected ? 'text-teal-400' : 'text-red-400'}`}>
                {connected ? 'LIVE' : 'OFFLINE'}
              </span>
            </div>
            {error && (
              <div className="text-xs text-red-400 mt-2">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="ml-72 flex flex-col h-full">
        {/* Top Bar */}
        <div className="glass-nav border-b border-white/10 px-6 py-4">
          <div className="flex items-center justify-between">
            <div><h1 className="text-xl font-bold text-white">Command Center</h1><p className="text-sm text-slate-400">Pune, India</p></div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-3 px-4 py-2 glass-card rounded-lg">
                <Leaf className={`w-4 h-4 ${ecoRouteEnabled ? 'text-green-400' : 'text-slate-500'}`} />
                <span className="text-sm font-medium text-white">Eco</span>
                <button onClick={() => setEcoRouteEnabled(!ecoRouteEnabled)} className={`relative w-11 h-6 rounded-full ${ecoRouteEnabled ? 'bg-teal-500' : 'bg-slate-700'}`}>
                  <motion.div animate={{ x: ecoRouteEnabled ? 20 : 0 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full" />
                </button>
              </div>
                <UserMenu/>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4 mt-4">
            <div className="glass-card p-3 rounded-lg"><div className="text-xs text-slate-500 uppercase mb-1">Active</div><div className="text-2xl font-bold text-white mono-numbers">{trucks.length}</div></div>
            <div className="glass-card p-3 rounded-lg"><div className="text-xs text-slate-500 uppercase mb-1">Cargo</div><div className="text-2xl font-bold text-teal-400 mono-numbers">${totalCargoValue.toLocaleString()}</div></div>
            <div className="glass-card p-3 rounded-lg"><div className="text-xs text-slate-500 uppercase mb-1">On-Time</div><div className="text-2xl font-bold text-cyan-400 mono-numbers">98%</div></div>
            <div className="glass-card p-3 rounded-lg"><div className="text-xs text-slate-500 uppercase mb-1">Saved</div><div className="text-2xl font-bold text-orange-400 mono-numbers">$12K</div></div>
          </div>
        </div>

        {/* Live Map with Real-Time Tracking */}
        <div className="flex-1 flex gap-4 p-4 overflow-hidden">
          {/* Map Container */}
          <div className="flex-1 rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
            <SupplyChainMap trucks={trucks} ecoMode={ecoRouteEnabled} />
          </div>
          
          {/* Agent Stream - Embedded on right side */}
          <AgentOverlay events={events} />
        </div>
      </div>

      {/* Financial Modal */}
      <AnimatePresence>
        {arbitrageOpportunity && <FinancialModal opportunity={arbitrageOpportunity} onExecute={executeArbitrage} onDismiss={dismissArbitrage} />}
      </AnimatePresence>
    </div>
  );
}
