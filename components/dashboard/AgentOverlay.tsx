'use client';

import React from 'react';
import { AgentEvent } from '@/lib/types';
import { motion } from 'framer-motion';
import { 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp
} from 'lucide-react';

interface AgentOverlayProps {
  events: AgentEvent[];
}

export default function AgentOverlay({ events }: AgentOverlayProps) {
  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return CheckCircle2;
      case 'alert': return AlertTriangle;
      case 'opportunity': return TrendingUp;
      default: return Activity;
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case 'success': return 'text-green-400';
      case 'alert': return 'text-amber-400';
      case 'opportunity': return 'text-teal-400';
      default: return 'text-blue-400';
    }
  };

  const formatTimestamp = (timestamp: Date | string): string => {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    return date.toLocaleTimeString();
  };

  const getTimestampKey = (timestamp: Date | string): string => {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    return date.getTime().toString();
  };

  return (
    <motion.div
      initial={{ x: 100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: 'spring', damping: 25, delay: 0.2 }}
      className="w-96 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden flex flex-col shadow-2xl"
    >
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">Agent Stream</h3>
          <p className="text-xs text-slate-400">Real-time system intelligence</p>
        </div>
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-2 h-2 bg-teal-500 rounded-full"
        />
      </div>

      {/* Events list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {events.slice().reverse().map((event, index) => {
          const Icon = getIcon(event.type);
          const colorClass = getColor(event.type);

          return (
            <motion.div
              key={`${event.id}-${getTimestampKey(event.timestamp)}-${index}`}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-slate-800/50 backdrop-blur-sm border border-white/5 rounded-lg p-3 hover:border-white/20 transition-colors"
            >
              <div className="flex gap-3">
                <div className={`mt-0.5 ${colorClass}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 leading-relaxed">
                    {event.message}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 font-mono" suppressHydrationWarning>
                    {formatTimestamp(event.timestamp)}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}

        {events.length === 0 && (
          <div className="text-center text-slate-500 py-8">
            <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Waiting for events...</p>
          </div>
        )}
      </div>

      {/* Footer stats */}
      <div className="p-4 border-t border-white/10 bg-slate-950/50">
        <div className="grid grid-cols-2 gap-3 text-center">
          <div>
            <div className="text-2xl font-bold text-teal-400">{events.length}</div>
            <div className="text-xs text-slate-400">Total Events</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-400">
              {events.filter(e => e.type === 'system').length}
            </div>
            <div className="text-xs text-slate-400">Actions Taken</div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
