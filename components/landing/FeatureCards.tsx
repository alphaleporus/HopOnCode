'use client';

import { useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { MapPin, TrendingUp, Leaf, Shield } from 'lucide-react';

// Figures from the live demo scenario (TRK-402 engine fault, Pune → Mumbai, just-in-time contract)
const DEMO = {
  activeTrucks: 3,
  cargoLakh: 250,          // ₹2.5 crore across the demo fleet
  driverActions: 0,
  doNothingCost: 38282,    // projected penalty if we wait for recovery
  bestFixCost: 15766,      // relief truck price + remaining risk, weighted by reliability
  extraCo2Kg: 25,          // relief truck driving to the pickup point
};

function AnimatedCounter({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string; }) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => prefix + Math.round(latest).toLocaleString('en-IN') + suffix);

  useEffect(() => {
    const controls = animate(count, value, { duration: 2, ease: 'easeOut' });
    return controls.stop;
  }, [value, count]);

  return <motion.span>{rounded}</motion.span>;
}

export default function FeatureCards() {
  const metrics = DEMO;
  const netSavings = metrics.doNothingCost - metrics.bestFixCost;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Real-Time Visibility */}
      <motion.div initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: 0.1 }} whileHover={{ y: -5 }} className="md:col-span-2 glass-card rounded-3xl p-8 hover:border-teal-500/30 transition-all relative overflow-hidden">
        <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.15, 0.1] }} transition={{ duration: 4, repeat: Infinity }} className="absolute -top-20 -right-20 w-60 h-60 bg-teal-500 rounded-full blur-3xl" />
        <div className="relative z-10">
          <motion.div whileHover={{ rotate: 360, scale: 1.1 }} transition={{ duration: 0.6 }} className="inline-block p-4 rounded-2xl bg-gradient-to-br from-teal-500/20 to-cyan-500/20 border border-teal-500/30 mb-6">
            <MapPin className="w-12 h-12 text-teal-400" />
          </motion.div>
          <h3 className="text-3xl font-bold text-white mb-4">Real-Time Visibility</h3>
          <p className="text-slate-400 text-lg leading-relaxed mb-8">Know within seconds when a truck stops. Reads the GPS and engine signals your trucks already send. No driver input.</p>
          <div className="grid grid-cols-3 gap-4">
            <motion.div whileHover={{ scale: 1.05 }} className="glass-card p-5 rounded-xl border border-teal-500/20">
              <div className="text-4xl font-bold text-white mono-numbers mb-2"><AnimatedCounter value={metrics.activeTrucks} /></div>
              <div className="text-xs text-slate-500 uppercase">Active Trucks</div>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} className="glass-card p-5 rounded-xl border border-teal-500/20">
              <div className="text-4xl font-bold text-teal-400 mono-numbers mb-2"><AnimatedCounter value={metrics.cargoLakh} prefix="₹" suffix=" L" /></div>
              <div className="text-xs text-slate-500 uppercase">Cargo Value</div>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} className="glass-card p-5 rounded-xl border border-green-500/20">
              <div className="text-4xl font-bold text-green-400 mono-numbers mb-2"><AnimatedCounter value={metrics.driverActions} /></div>
              <div className="text-xs text-slate-500 uppercase">Driver Actions</div>
            </motion.div>
          </div>
          <div className="mt-4 text-xs text-slate-600 flex items-center gap-2">
            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity }} className="w-2 h-2 bg-teal-500 rounded-full" />
            <span>Example figures from the live demo</span>
          </div>
        </div>
      </motion.div>

      {/* Financial Arbitrage */}
      <motion.div initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: 0.2 }} whileHover={{ y: -5 }} className="md:row-span-2 glass-card rounded-3xl p-8 hover:border-orange-500/30 transition-all relative overflow-hidden">
        <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.15, 0.1] }} transition={{ duration: 4, repeat: Infinity, delay: 1 }} className="absolute -top-20 -left-20 w-60 h-60 bg-orange-500 rounded-full blur-3xl" />
        <div className="relative z-10">
          <motion.div whileHover={{ rotate: 360, scale: 1.1 }} transition={{ duration: 0.6 }} className="inline-block p-4 rounded-2xl bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/30 mb-6">
            <TrendingUp className="w-12 h-12 text-orange-400" />
          </motion.div>
          <h3 className="text-3xl font-bold text-white mb-4">Cheapest Fix, Priced</h3>
          <p className="text-slate-400 leading-relaxed mb-8">Detects delays, prices contract penalties, and compares every recovery option by expected cost.</p>
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-xl bg-red-500/5 border border-red-500/20">
              <span className="text-sm text-slate-400">Do nothing</span>
              <span className="text-2xl font-bold text-red-400 mono-numbers"><AnimatedCounter value={metrics.doNothingCost} prefix="-₹" /></span>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-orange-500/5 border border-orange-500/20">
              <span className="text-sm text-slate-400">Best fix (relief truck)</span>
              <span className="text-2xl font-bold text-orange-400 mono-numbers"><AnimatedCounter value={metrics.bestFixCost} prefix="₹" /></span>
            </div>
            <div className="h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
            <div className="flex items-center justify-between p-6 rounded-2xl bg-gradient-to-br from-teal-500/10 to-transparent border-2 border-teal-500/30">
              <span className="text-base font-semibold text-white">Saved</span>
              <motion.span animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 1.5, repeat: Infinity }} className="text-4xl font-black text-teal-400 neon-teal mono-numbers">
                <AnimatedCounter value={netSavings} prefix="+₹" />
              </motion.span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Carbon Credits */}
      <motion.div initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: 0.3 }} whileHover={{ y: -5 }} className="glass-card rounded-3xl p-8 hover:border-green-500/30 transition-all relative overflow-hidden">
        <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.15, 0.1] }} transition={{ duration: 4, repeat: Infinity, delay: 2 }} className="absolute -bottom-20 -right-20 w-60 h-60 bg-green-500 rounded-full blur-3xl" />
        <div className="relative z-10">
          <motion.div whileHover={{ rotate: 360, scale: 1.1 }} transition={{ duration: 0.6 }} className="inline-block p-4 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 mb-6">
            <Leaf className="w-12 h-12 text-green-400" />
          </motion.div>
          <h3 className="text-2xl font-bold text-white mb-4">Carbon Shown Upfront</h3>
          <p className="text-slate-400 leading-relaxed mb-6">Every fix shows the extra emissions it causes before anyone approves it.</p>
          <motion.div whileHover={{ scale: 1.05 }} className="glass-card p-6 rounded-2xl border-2 border-green-500/20">
            <div className="text-5xl font-black text-green-400 mono-numbers mb-2"><AnimatedCounter value={metrics.extraCo2Kg} prefix="+" suffix=" kg" /></div>
            <div className="text-sm text-slate-500">Extra CO₂ for the demo fix</div>
          </motion.div>
        </div>
      </motion.div>

      {/* Contract Intelligence */}
      <motion.div initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: 0.4 }} whileHover={{ y: -5 }} className="glass-card rounded-3xl p-8 hover:border-blue-500/30 transition-all relative overflow-hidden">
        <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.15, 0.1] }} transition={{ duration: 4, repeat: Infinity, delay: 3 }} className="absolute -top-20 -left-20 w-60 h-60 bg-blue-500 rounded-full blur-3xl" />
        <div className="relative z-10">
          <motion.div whileHover={{ rotate: 360, scale: 1.1 }} transition={{ duration: 0.6 }} className="inline-block p-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 mb-6">
            <Shield className="w-12 h-12 text-blue-400" />
          </motion.div>
          <h3 className="text-2xl font-bold text-white mb-4">Contract Intelligence</h3>
          <p className="text-slate-400 leading-relaxed mb-6">Every decision follows your contract terms: grace periods, caps, cold-chain limits, force majeure.</p>
          <div className="flex flex-wrap gap-2">
            {['Deadline & grace period', 'Penalty per hour & cap', 'Cold-chain limit', 'Force majeure'].map(term => (
              <span key={term} className="text-xs px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300">{term}</span>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
