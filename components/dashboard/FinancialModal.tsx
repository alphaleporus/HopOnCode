'use client';

import {motion} from 'framer-motion';
import {X} from 'lucide-react';
import {ArbitrageOpportunity} from '@/lib/types';
import {formatINR} from '@/lib/utils/format';
import OptionsTable from './OptionsTable';

interface FinancialModalProps {
    opportunity: ArbitrageOpportunity;
    onExecute: () => void;
    onDismiss: () => void;
}

/** A decision that needs an operator: the engine's recommendation with every option it compared. */
export default function FinancialModal({opportunity: o, onExecute, onDismiss}: FinancialModalProps) {
    return (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center p-4">
            <motion.div initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}}
                        className="absolute inset-0 bg-ink/40" onClick={onDismiss}/>
            <motion.div initial={{opacity: 0, y: 8}} animate={{opacity: 1, y: 0}} exit={{opacity: 0, y: 8}}
                        transition={{duration: 0.15}}
                        className="relative bg-surface border border-line rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-auto">
                <header className="px-6 py-4 border-b border-line flex items-start justify-between gap-4">
                    <div>
                        <p className="label-caps !text-alert">Decision needed · {o.truckId}</p>
                        <h2 className="text-lg font-semibold mt-1">Recommended: {o.solutionType}</h2>
                    </div>
                    <button onClick={onDismiss} aria-label="Close" className="p-2 rounded-md hover:bg-paper">
                        <X className="w-5 h-5 text-muted"/>
                    </button>
                </header>

                <div className="p-6 space-y-5">
                    <p className="text-sm text-ink-2 leading-relaxed">{o.details}</p>

                    <div className="grid grid-cols-3 border border-line rounded-lg divide-x divide-line">
                        <div className="px-4 py-3">
                            <div className="label-caps">If we do nothing</div>
                            <div className="mono-numbers text-xl font-semibold text-alert mt-1">{formatINR(o.projectedPenalty)}</div>
                        </div>
                        <div className="px-4 py-3">
                            <div className="label-caps">Relief truck price</div>
                            <div className="mono-numbers text-xl font-semibold mt-1">{formatINR(o.solutionCost)}</div>
                        </div>
                        <div className="px-4 py-3 bg-clear/5">
                            <div className="label-caps">Expected saving</div>
                            <div className="mono-numbers text-xl font-semibold text-clear mt-1">{formatINR(o.netSavings)}</div>
                        </div>
                    </div>

                    {o.options && o.options.length > 1 && (
                        <OptionsTable options={o.options} best={o.solutionType} confidence={o.confidence}/>
                    )}
                </div>

                <footer className="px-6 py-4 border-t border-line flex justify-end gap-3">
                    <button onClick={onDismiss} className="btn-ghost px-4 py-2 rounded-md text-sm font-medium">Not now</button>
                    <button onClick={onExecute} className="btn-primary px-4 py-2 rounded-md text-sm">
                        Approve and book {o.solutionType.replace('Relief truck via ', '')}
                    </button>
                </footer>
            </motion.div>
        </div>
    );
}
