'use client';

import { useEffect, useState } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { MapPin, TrendingUp, Leaf, Shield } from 'lucide-react';

function generateDailyMetrics() {
  const today = new Date().toDateString();
  const savedData = typeof window !== 'undefined' ? localStorage.getItem('metricsDate') : null;
  
  if (savedData !== today) {
    const newMetrics = {
      activeTrucks: Math.floor(Math.random() * 3) + 3,
      cargoValue: Math.floor(Math.random() * 100000) + 400000,
      onTimeRate: Math.floor(Math.random() * 3) + 96,
      penaltyCost: Math.floor(Math.random() * 1000) + 2000,
      solutionCost: Math.floor(Math.random() * 400) + 600,
      carbonCredits: Math.floor(Math.random() * 100) + 400,
      date: today
    };
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('dailyMetrics', JSON.stringify(newMetrics));
      localStorage.setItem('metricsDate', today);
    }
    
    return newMetrics;
  }
  
  const saved = typeof window !== 'undefined' ? localStorage.getItem('dailyMetrics') : null;
  return saved ? JSON.parse(saved) : { activeTrucks: 4, cargoValue: 450000, onTimeRate: 98, penaltyCost: 2500, solutionCost: 800, carbonCredits: 450, date: today };
}

function AnimatedCounter({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string; }) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => prefix + latest.toLocaleString('en-US') + suffix);

  useEffect(() => {
    const controls = animate(count, value, { duration: 2, ease: 'easeOut' });
    return controls.stop;
  }, [value, count]);

  return <motion.span>{rounded}</motion.span>;
}

export default function FeatureCards() {
  const [metrics, setMetrics] = useState(generateDailyMetrics());

  useEffect(() => {
    const interval = setInterval(() => setMetrics(generateDailyMetrics()), 3600000);
    return () => clearInterval(interval);
  }, []);

  const netSavings = metrics.penaltyCost - metrics.solutionCost;

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
          <p className="text-slate-400 text-lg leading-relaxed mb-8">Track every shipment with sub-second precision. Our AI monitors 10,000+ data points per truck, per minute.</p>
          <div className="grid grid-cols-3 gap-4">
            <motion.div whileHover={{ scale: 1.05 }} className="glass-card p-5 rounded-xl border border-teal-500/20">
              <div className="text-4xl font-bold text-white mono-numbers mb-2"><AnimatedCounter value={metrics.activeTrucks} /></div>
              <div className="text-xs text-slate-500 uppercase">Active Trucks</div>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} className="glass-card p-5 rounded-xl border border-teal-500/20">
              <div className="text-4xl font-bold text-teal-400 mono-numbers mb-2"><AnimatedCounter value={metrics.cargoValue / 1000} prefix="$" suffix="K" /></div>
              <div className="text-xs text-slate-500 uppercase">Cargo Value</div>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} className="glass-card p-5 rounded-xl border border-green-500/20">
              <div className="text-4xl font-bold text-green-400 mono-numbers mb-2"><AnimatedCounter value={metrics.onTimeRate} suffix="%" /></div>
              <div className="text-xs text-slate-500 uppercase">On-Time</div>
            </motion.div>
          </div>
          <div className="mt-4 text-xs text-slate-600 flex items-center gap-2">
            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity }} className="w-2 h-2 bg-teal-500 rounded-full" />
            <span>Live data • Updates every 24h</span>
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
          <h3 className="text-3xl font-bold text-white mb-4">Financial Arbitrage</h3>
          <p className="text-slate-400 leading-relaxed mb-8">AI detects delays, calculates penalties, and finds cheaper alternatives—automatically.</p>
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-xl bg-red-500/5 border border-red-500/20">
              <span className="text-sm text-slate-400">Penalty Cost</span>
              <span className="text-2xl font-bold text-red-400 mono-numbers"><AnimatedCounter value={metrics.penaltyCost} prefix="-$" /></span>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-orange-500/5 border border-orange-500/20">
              <span className="text-sm text-slate-400">Solution Cost</span>
              <span className="text-2xl font-bold text-orange-400 mono-numbers"><AnimatedCounter value={metrics.solutionCost} prefix="$" /></span>
            </div>
            <div className="h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
            <div className="flex items-center justify-between p-6 rounded-2xl bg-gradient-to-br from-teal-500/10 to-transparent border-2 border-teal-500/30">
              <span className="text-base font-semibold text-white">Net Savings</span>
              <motion.span animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 1.5, repeat: Infinity }} className="text-4xl font-black text-teal-400 neon-teal mono-numbers">
                <AnimatedCounter value={netSavings} prefix="+$" />
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
          <h3 className="text-2xl font-bold text-white mb-4">Carbon Credits</h3>
          <p className="text-slate-400 leading-relaxed mb-6">Eco-routes that earn you money while saving the planet.</p>
          <motion.div whileHover={{ scale: 1.05 }} className="glass-card p-6 rounded-2xl border-2 border-green-500/20">
            <div className="text-5xl font-black text-green-400 mono-numbers mb-2"><AnimatedCounter value={metrics.carbonCredits} prefix="+$" /></div>
            <div className="text-sm text-slate-500">Credits Earned Today</div>
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
          <p className="text-slate-400 leading-relaxed mb-6">AI reads your SLAs and negotiates penalties automatically.</p>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: '87%' }} transition={{ delay: 1.5, duration: 1.5 }} className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full" />
              </div>
              <span className="text-sm text-blue-400 mono-numbers">87%</span>
            </div>
            <p className="text-xs text-slate-500">Contracts analyzed & optimized</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
