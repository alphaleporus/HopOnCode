'use client';

import React, { useState } from 'react';
import { ArbitrageOpportunity } from '@/lib/types';
import { formatINR } from '@/lib/utils/format';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { 
  X, 
  AlertCircle, 
  TrendingDown, 
  TrendingUp, 
  Zap,
  CheckCircle2 
} from 'lucide-react';

interface FinancialModalProps {
  opportunity: ArbitrageOpportunity | null;
  onExecute: () => void;
  onDismiss: () => void;
}

export default function FinancialModal({ opportunity, onExecute, onDismiss }: FinancialModalProps) {
  const [executing, setExecuting] = useState(false);

  if (!opportunity) return null;

  const handleExecute = () => {
    setExecuting(true);
    
    // Trigger confetti animation
    const duration = 2000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 10002 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval: NodeJS.Timeout = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      
      // Launch confetti from two sides
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);
    
    setTimeout(() => {
      onExecute();
      setExecuting(false);
    }, 1500);
  };

  return (
    <AnimatePresence>
      {opportunity && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onDismiss}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000]"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25 }}
            className="fixed inset-0 flex items-center justify-center z-[10001] p-4"
          >
            <div className="bg-slate-900 border border-white/10 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="bg-gradient-to-r from-amber-500/20 to-red-500/20 border-b border-white/10 p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-amber-500/20 rounded-lg">
                      <AlertCircle className="w-6 h-6 text-amber-400" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-slate-100">
                        Recommended fix for {opportunity.truckId}
                      </h2>
                      <p className="text-slate-400 mt-1">
                        {opportunity.details}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onDismiss}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                {/* Every option the engine compared, scored by expected total cost */}
                {opportunity.options && opportunity.options.length > 1 ? (
                  <div className="mb-6 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-slate-400 border-b border-white/10">
                          <th className="py-2 pr-3 font-medium">Option</th>
                          <th className="py-2 pr-3 font-medium text-right">Price</th>
                          <th className="py-2 pr-3 font-medium text-right">Arrives in</th>
                          <th className="py-2 pr-3 font-medium text-right">Late by</th>
                          <th className="py-2 pr-3 font-medium text-right">Reliability</th>
                          <th className="py-2 font-medium text-right">Expected total cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {opportunity.options.map(o => {
                          const best = o.label === opportunity.solutionType;
                          return (
                            <tr key={o.label} className={`border-b border-white/5 ${best ? 'bg-teal-500/10 text-teal-200' : o.kind === 'wait' ? 'text-red-200' : 'text-slate-300'}`}>
                              <td className="py-2 pr-3">
                                {o.kind === 'wait' ? 'Do nothing (wait for recovery)' : o.label}
                                {best && <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-teal-500/30 text-teal-200">BEST</span>}
                              </td>
                              <td className="py-2 pr-3 text-right mono-numbers">{o.kind === 'wait' ? '—' : formatINR(o.direct_cost)}</td>
                              <td className="py-2 pr-3 text-right mono-numbers">{o.arrival_hours.toFixed(1)} h</td>
                              <td className="py-2 pr-3 text-right mono-numbers">{o.lateness_hours > 0 ? `${o.lateness_hours.toFixed(1)} h` : 'on time'}</td>
                              <td className="py-2 pr-3 text-right mono-numbers">{Math.round(o.reliability * 100)}%</td>
                              <td className="py-2 text-right mono-numbers font-semibold">{formatINR(o.expected_cost)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <p className="text-xs text-slate-500 mt-2">
                      Expected total cost = price + penalties and spoilage still likely after the fix, weighted by how reliable the carrier is.
                      {opportunity.confidence !== undefined && ` Confidence ${Math.round(opportunity.confidence * 100)}%.`}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <TrendingDown className="w-5 h-5 text-red-400" />
                        <span className="font-semibold text-slate-200">Do nothing</span>
                      </div>
                      <div className="text-4xl font-bold text-red-400 mb-2">{formatINR(opportunity.projectedPenalty)}</div>
                      <div className="text-xs text-slate-500">Projected penalty</div>
                    </div>
                    <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <TrendingUp className="w-5 h-5 text-teal-400" />
                        <span className="font-semibold text-slate-200">{opportunity.solutionType}</span>
                      </div>
                      <div className="text-4xl font-bold text-teal-400 mb-2">{formatINR(opportunity.solutionCost)}</div>
                      <div className="text-xs text-slate-500">Price</div>
                    </div>
                  </div>
                )}

                {/* Net Savings - The Star */}
                <motion.div
                  animate={{ scale: [1, 1.02, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-2 border-green-500/30 rounded-xl p-6 mb-6"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-slate-400 mb-2">Expected saving vs doing nothing</div>
                      <div className="text-5xl font-bold text-green-400">
                        {formatINR(opportunity.netSavings)}
                      </div>
                    </div>
                    <motion.div
                      animate={{ rotate: [0, 5, -5, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <Zap className="w-16 h-16 text-green-400" />
                    </motion.div>
                  </div>
                </motion.div>

                {/* Action buttons */}
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={onDismiss}
                    className="py-4 px-6 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-xl font-semibold text-slate-300 transition-all"
                  >
                    Ignore
                  </button>
                  <motion.button
                    onClick={handleExecute}
                    disabled={executing}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="py-4 px-6 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 rounded-xl font-bold text-white shadow-lg shadow-teal-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {executing ? (
                      <span className="flex items-center justify-center gap-2">
                        <CheckCircle2 className="w-5 h-5 animate-spin" />
                        Executing...
                      </span>
                    ) : (
                      'Execute 1-Click Fix'
                    )}
                  </motion.button>
                </div>

                {/* Disclaimer */}
                <p className="text-xs text-center text-slate-600 mt-4">
                  This action will automatically execute the solution and update the supply chain in real-time.
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
