import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBlueprint } from '../hooks/useBlueprint';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { Coins, Zap, Trophy, ShieldCheck, AlertTriangle, ChevronDown, ChevronUp, Settings2 } from 'lucide-react';

// ── Bonding Curve Visualization ──────────────────────────────────
function CurveChart({ progress }: { progress: number }) {
    const points = useMemo(() => {
        const pts: string[] = [];
        const w = 200, h = 60;
        for (let i = 0; i <= 50; i++) {
            const x = (i / 50) * w;
            // Exponential curve shape
            const t = i / 50;
            const y = h - (Math.pow(t, 2.2) * h);
            pts.push(`${x},${y}`);
        }
        return pts.join(' ');
    }, []);

    const markerX = Math.min(progress, 1) * 200;
    const markerY = 60 - (Math.pow(Math.min(progress, 1), 2.2) * 60);

    return (
        <div className="relative w-full h-[80px] rounded-lg bg-slate-950/60 border border-slate-800/50 overflow-hidden p-2">
            <svg viewBox="0 0 200 60" className="w-full h-full" preserveAspectRatio="none">
                {/* Grid lines */}
                {[0.25, 0.5, 0.75].map(t => (
                    <line key={t} x1={t * 200} y1="0" x2={t * 200} y2="60"
                        stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2,2" />
                ))}
                {[0.25, 0.5, 0.75].map(t => (
                    <line key={`h${t}`} x1="0" y1={t * 60} x2="200" y2={t * 60}
                        stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2,2" />
                ))}

                {/* Filled area under curve up to progress */}
                <defs>
                    <linearGradient id="curveGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#00ffff" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#00ffff" stopOpacity="0.02" />
                    </linearGradient>
                </defs>

                {/* Area fill */}
                {progress > 0 && (
                    <polygon
                        points={`0,60 ${points.split(' ').filter((_, i) => i <= Math.floor(progress * 50)).join(' ')} ${markerX},${markerY} ${markerX},60`}
                        fill="url(#curveGrad)"
                    />
                )}

                {/* Curve line */}
                <polyline points={points} fill="none" stroke="#00cccc" strokeWidth="1.5" opacity="0.4" />

                {/* Active segment */}
                <polyline
                    points={points.split(' ').filter((_, i) => i <= Math.floor(progress * 50)).join(' ')}
                    fill="none" stroke="#00ffff" strokeWidth="2"
                />

                {/* Progress marker */}
                <circle cx={markerX} cy={markerY} r="4" fill="#00ffff" filter="url(#glow)" />
                <circle cx={markerX} cy={markerY} r="2" fill="#ffffff" />

                <defs>
                    <filter id="glow">
                        <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>
            </svg>

            {/* Labels */}
            <div className="absolute bottom-0 left-2 text-[9px] text-slate-600 font-mono">0%</div>
            <div className="absolute bottom-0 right-2 text-[9px] text-slate-600 font-mono">100%</div>
            <div className="absolute top-0 right-2 text-[9px] text-cyan-500/70 font-mono">
                {(progress * 100).toFixed(1)}% filled
            </div>
        </div>
    );
}

// ── Slippage Selector ────────────────────────────────────────────
function SlippageControl({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const presets = [0.1, 0.5, 1.0, 2.0];

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors bg-slate-800/50 px-2 py-1 rounded border border-slate-700/50 hover:border-slate-600"
            >
                <Settings2 className="w-3 h-3" />
                <span>{value}% slip</span>
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -4, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.95 }}
                        className="absolute top-full right-0 mt-1 z-50 bg-slate-900 border border-slate-700 rounded-lg p-2 min-w-[140px] shadow-xl"
                    >
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 px-1">Slippage Tolerance</div>
                        <div className="flex gap-1">
                            {presets.map(p => (
                                <button
                                    key={p}
                                    onClick={() => { onChange(p); setIsOpen(false); }}
                                    className={`flex-1 py-1 text-xs rounded transition-all ${value === p
                                        ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                                        : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
                                        }`}
                                >
                                    {p}%
                                </button>
                            ))}
                        </div>
                        {value > 1 && (
                            <div className="flex items-center gap-1 mt-1.5 text-[10px] text-yellow-400/80 px-1">
                                <AlertTriangle className="w-3 h-3" />
                                High slippage risk
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ── Main Component ───────────────────────────────────────────────
export const BondingCurve = () => {
    const {
        buy, sell, price, supply, marketCap, curveProgress,
        isLoading, error, isMainnet,
        slippage, setSlippage,
        quote, quoteLoading, fetchQuote,
    } = useBlueprint();

    const [amount, setAmount] = useState<string>('100');
    const [mode, setMode] = useState<'buy' | 'sell'>('buy');
    const [txResult, setTxResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [showDetails, setShowDetails] = useState(false);

    // Fetch quote on amount/mode change
    useEffect(() => {
        const val = parseFloat(amount);
        if (val > 0) fetchQuote(val, mode);
    }, [amount, mode, fetchQuote]);

    // Clear tx notification after 4s
    useEffect(() => {
        if (txResult) {
            const t = setTimeout(() => setTxResult(null), 4000);
            return () => clearTimeout(t);
        }
    }, [txResult]);

    const handleAction = async () => {
        try {
            const val = parseFloat(amount);
            if (!val || val <= 0) return;

            const result = mode === 'buy' ? await buy(val) : await sell(val);
            setTxResult({ type: 'success', message: result?.message || `${mode === 'buy' ? 'Purchase' : 'Sale'} successful!` });
        } catch (e: any) {
            setTxResult({ type: 'error', message: e.message || 'Transaction failed' });
        }
    };

    const solEstimate = parseFloat(amount || '0') * price;

    return (
        <Card glass className="border-cyan-500/30 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-5">
                <Coins size={120} />
            </div>

            <CardHeader className="bg-slate-900/50 border-b border-slate-800">
                <div className="flex justify-between items-center">
                    <CardTitle className="text-cyan-400 font-bold flex items-center gap-2 text-base">
                        <Coins className="w-5 h-5" /> $NDRIFT Economy
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        {!isMainnet && (
                            <span className="text-[9px] font-bold text-yellow-400 bg-yellow-500/10 px-1.5 py-0.5 rounded border border-yellow-500/20 uppercase tracking-wider">
                                Devnet
                            </span>
                        )}
                        <div className="text-xs font-mono font-bold text-purple-400 bg-purple-500/10 px-2 py-1 rounded">
                            {price.toFixed(6)} SOL
                        </div>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-5 space-y-5">
                {/* Bonding Curve Chart */}
                <CurveChart progress={curveProgress} />

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-2">
                    <div className="bg-slate-900/60 rounded-lg p-2.5 border border-slate-800/50 text-center">
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Supply</div>
                        <div className="text-sm font-bold text-slate-200 font-mono">
                            {supply >= 1_000_000 ? `${(supply / 1_000_000).toFixed(1)}M` : supply.toLocaleString()}
                        </div>
                    </div>
                    <div className="bg-slate-900/60 rounded-lg p-2.5 border border-slate-800/50 text-center">
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Mkt Cap</div>
                        <div className="text-sm font-bold text-green-400 font-mono">
                            {marketCap >= 1000 ? `$${(marketCap / 1000).toFixed(1)}K` : `$${marketCap.toFixed(0)}`}
                        </div>
                    </div>
                    <div className="bg-slate-900/60 rounded-lg p-2.5 border border-slate-800/50 text-center">
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Progress</div>
                        <div className="text-sm font-bold text-cyan-400 font-mono">
                            {(curveProgress * 100).toFixed(1)}%
                        </div>
                    </div>
                </div>

                {/* Token Utility */}
                <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="flex items-center justify-between w-full text-xs text-slate-400 hover:text-slate-300 transition-colors py-1"
                >
                    <span className="font-semibold uppercase tracking-wider">Token Utility</span>
                    {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                <AnimatePresence>
                    {showDetails && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden text-sm text-slate-400 space-y-2"
                        >
                            <div className="flex items-start gap-2.5">
                                <Trophy className="w-3.5 h-3.5 text-yellow-400 mt-0.5 shrink-0" />
                                <span><strong className="text-slate-300">Match Entry:</strong> Pay with $NDRIFT for discounted rates.</span>
                            </div>
                            <div className="flex items-start gap-2.5">
                                <Zap className="w-3.5 h-3.5 text-cyan-400 mt-0.5 shrink-0" />
                                <span><strong className="text-slate-300">Car Boosts:</strong> Upgrade engine parts on-chain.</span>
                            </div>
                            <div className="flex items-start gap-2.5">
                                <ShieldCheck className="w-3.5 h-3.5 text-purple-400 mt-0.5 shrink-0" />
                                <span><strong className="text-slate-300">Tournaments:</strong> Exclusive high-stakes circuits.</span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Swap Panel */}
                <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-700/50 space-y-3">
                    <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Swap NDRIFT</h4>
                        <SlippageControl value={slippage} onChange={setSlippage} />
                    </div>

                    {/* TX Result Toast */}
                    <AnimatePresence>
                        {txResult && (
                            <motion.div
                                initial={{ opacity: 0, y: -8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                className={`text-xs p-2 rounded-lg border ${txResult.type === 'success'
                                    ? 'bg-green-500/10 border-green-500/30 text-green-400'
                                    : 'bg-red-500/10 border-red-500/30 text-red-400'
                                    }`}
                            >
                                {txResult.message}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {error && <div className="text-red-500 text-xs bg-red-500/10 p-2 rounded border border-red-500/20">Error: {error.message}</div>}

                    {/* Buy/Sell Toggle */}
                    <div className="flex bg-slate-950 rounded-lg p-1 border border-slate-800">
                        <button
                            onClick={() => setMode('buy')}
                            className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-all ${mode === 'buy' ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/20' : 'text-slate-500 hover:text-white'}`}
                        >
                            Buy
                        </button>
                        <button
                            onClick={() => setMode('sell')}
                            className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-all ${mode === 'sell' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'text-slate-500 hover:text-white'}`}
                        >
                            Sell
                        </button>
                    </div>

                    {/* Amount Input */}
                    <div>
                        <div className="flex justify-between text-xs text-slate-500 mb-1 px-1">
                            <label>Amount (NDRIFT)</label>
                            <span className="font-mono">~{solEstimate.toFixed(4)} SOL</span>
                        </div>
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:border-cyan-500 outline-none transition-colors font-mono"
                            disabled={isLoading}
                            min="0"
                            placeholder="0"
                        />
                    </div>

                    {/* Quote Preview */}
                    {quote && !quoteLoading && parseFloat(amount) > 0 && (
                        <div className="bg-slate-950/60 rounded-lg p-2.5 border border-slate-800/50 space-y-1.5 text-xs">
                            <div className="flex justify-between text-slate-400">
                                <span>Est. {mode === 'buy' ? 'tokens' : 'SOL received'}</span>
                                <span className="text-slate-200 font-mono font-bold">
                                    {mode === 'buy'
                                        ? quote.estimatedAmount.toLocaleString()
                                        : quote.estimatedAmount.toFixed(6)
                                    }
                                </span>
                            </div>
                            <div className="flex justify-between text-slate-400">
                                <span>Price Impact</span>
                                <span className={`font-mono ${quote.priceImpact > 2 ? 'text-red-400' : quote.priceImpact > 0.5 ? 'text-yellow-400' : 'text-green-400'}`}>
                                    {quote.priceImpact.toFixed(2)}%
                                </span>
                            </div>
                            <div className="flex justify-between text-slate-400">
                                <span>Fee</span>
                                <span className="text-slate-300 font-mono">{quote.fee.toFixed(6)} SOL</span>
                            </div>
                        </div>
                    )}

                    {/* Action Button */}
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleAction}
                        disabled={isLoading || !parseFloat(amount)}
                        className={`w-full py-3 rounded-lg font-bold text-sm shadow-xl transition-all uppercase tracking-wider ${isLoading || !parseFloat(amount) ? 'opacity-50 cursor-not-allowed' : ''} ${mode === 'buy'
                            ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-black shadow-cyan-500/20'
                            : 'bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 text-white shadow-purple-500/20'
                            }`}
                    >
                        {isLoading
                            ? 'Processing...'
                            : !isMainnet
                                ? `${mode === 'buy' ? 'Buy' : 'Sell'} (Devnet Mock)`
                                : `${mode === 'buy' ? 'Purchase' : 'Sell'} $NDRIFT`
                        }
                    </motion.button>

                    {/* Bags.fm Attribution */}
                    <div className="text-center">
                        <span className="text-[9px] text-slate-600">
                            Powered by <a href="https://bags.fm" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-slate-400 underline">bags.fm</a>
                        </span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
