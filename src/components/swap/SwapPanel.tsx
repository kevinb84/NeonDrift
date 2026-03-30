import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { ArrowDownUp, AlertTriangle, Settings2, ExternalLink } from 'lucide-react';
import { TokenSelector } from './TokenSelector';
import { BagsToken, tokenService, TokenPrice } from '../../services/TokenService';
import { blueprintService, IS_MAINNET, TradeQuote } from '../../services/BlueprintService';
import { NDRIFT_TOKEN_ADDRESS } from '../../lib/constants';

// ─── Slippage Selector ───────────────────────────────────────────
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
                <span>{value}%</span>
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -4, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.95 }}
                        className="absolute top-full right-0 mt-1 z-50 bg-slate-900 border border-slate-700 rounded-lg p-2 min-w-[140px] shadow-xl"
                    >
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 px-1">Slippage</div>
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
                                High slippage
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── Mini Curve Chart ────────────────────────────────────────────
function MiniCurve({ progress }: { progress: number }) {
    const pts: string[] = [];
    for (let i = 0; i <= 30; i++) {
        const x = (i / 30) * 100;
        const y = 30 - (Math.pow(i / 30, 2.2) * 30);
        pts.push(`${x},${y}`);
    }

    const mx = Math.min(progress, 1) * 100;
    const my = 30 - (Math.pow(Math.min(progress, 1), 2.2) * 30);

    return (
        <svg viewBox="0 0 100 30" className="w-full h-[30px]" preserveAspectRatio="none">
            <polyline points={pts.join(' ')} fill="none" stroke="#334155" strokeWidth="1" />
            <polyline
                points={pts.filter((_, i) => i <= Math.floor(progress * 30)).join(' ')}
                fill="none" stroke="#00cccc" strokeWidth="1.5"
            />
            <circle cx={mx} cy={my} r="2" fill="#00ffff" />
        </svg>
    );
}

// ─── Main SwapPanel ──────────────────────────────────────────────
export const SwapPanel = () => {
    const { publicKey, sendTransaction } = useWallet();
    const { connection } = useConnection();

    // State
    const [selectedToken, setSelectedToken] = useState<BagsToken | null>(null);
    const [tokenPrice, setTokenPrice] = useState<TokenPrice | null>(null);
    const [mode, setMode] = useState<'buy' | 'sell'>('buy');
    const [amount, setAmount] = useState('');
    const [slippage, setSlippage] = useState(0.5);
    const [quote, setQuote] = useState<TradeQuote | null>(null);
    const [quoteLoading, setQuoteLoading] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [txResult, setTxResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // Load default token (NDRIFT)
    useEffect(() => {
        tokenService.getTokenFeed().then(tokens => {
            const ndrift = tokens.find(t => t.tokenMint === NDRIFT_TOKEN_ADDRESS) || tokens[0];
            if (ndrift) setSelectedToken(ndrift);
        });
    }, []);

    // Fetch price when token changes
    useEffect(() => {
        if (!selectedToken) return;
        tokenService.getTokenPrice(selectedToken.tokenMint).then(setTokenPrice);
        const interval = setInterval(() => {
            tokenService.getTokenPrice(selectedToken.tokenMint).then(setTokenPrice);
        }, IS_MAINNET ? 10000 : 30000);
        return () => clearInterval(interval);
    }, [selectedToken?.tokenMint]);

    // Fetch quote (debounced)
    useEffect(() => {
        if (!selectedToken || !amount || parseFloat(amount) <= 0) {
            setQuote(null);
            return;
        }
        const timer = setTimeout(async () => {
            setQuoteLoading(true);
            try {
                const q = await blueprintService.getTradeQuote(selectedToken.tokenMint, parseFloat(amount), mode);
                setQuote(q);
            } catch {
                setQuote(null);
            }
            setQuoteLoading(false);
        }, 300);
        return () => clearTimeout(timer);
    }, [amount, mode, selectedToken?.tokenMint]);

    // Clear tx result after 4s
    useEffect(() => {
        if (txResult) {
            const t = setTimeout(() => setTxResult(null), 4000);
            return () => clearTimeout(t);
        }
    }, [txResult]);

    const handleSwap = useCallback(async () => {
        if (!publicKey || !selectedToken) return;
        const val = parseFloat(amount);
        if (!val || val <= 0) return;

        setIsLoading(true);
        try {
            if (!IS_MAINNET) {
                await new Promise(r => setTimeout(r, 1500));
                setTxResult({ type: 'success', message: `DEVNET MOCK: ${mode === 'buy' ? 'Bought' : 'Sold'} ${val} ${selectedToken.symbol}` });
                setIsLoading(false);
                return;
            }

            const tx = mode === 'buy'
                ? await blueprintService.buildBuyTransaction(selectedToken.tokenMint, publicKey, val, slippage)
                : await blueprintService.buildSellTransaction(selectedToken.tokenMint, publicKey, val, slippage);

            const signature = await sendTransaction(tx, connection);
            const latestBlockhash = await connection.getLatestBlockhash();
            await connection.confirmTransaction({
                signature,
                blockhash: latestBlockhash.blockhash,
                lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
            });

            setTxResult({ type: 'success', message: `${mode === 'buy' ? 'Purchase' : 'Sale'} confirmed!` });
            // Refresh price
            tokenService.getTokenPrice(selectedToken.tokenMint).then(setTokenPrice);
        } catch (e: any) {
            setTxResult({ type: 'error', message: e.message || 'Transaction failed' });
        } finally {
            setIsLoading(false);
        }
    }, [publicKey, selectedToken, amount, mode, slippage, connection, sendTransaction]);

    const solEstimate = parseFloat(amount || '0') * (tokenPrice?.price || 0);

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <ArrowDownUp className="w-4 h-4 text-cyan-400" />
                    Swap
                </h3>
                <div className="flex items-center gap-2">
                    {!IS_MAINNET && (
                        <span className="text-[9px] font-bold text-yellow-400 bg-yellow-500/10 px-1.5 py-0.5 rounded border border-yellow-500/20 uppercase tracking-wider">
                            Devnet
                        </span>
                    )}
                    <SlippageControl value={slippage} onChange={setSlippage} />
                </div>
            </div>

            {/* Token Selector */}
            <TokenSelector selectedToken={selectedToken} onSelect={setSelectedToken} />

            {/* Token Stats (when selected) */}
            {selectedToken && tokenPrice && (
                <div className="grid grid-cols-3 gap-2">
                    <div className="bg-slate-900/60 rounded-lg p-2 border border-slate-800/50 text-center">
                        <div className="text-[9px] text-slate-500 uppercase tracking-wider">Price</div>
                        <div className="text-xs font-bold text-white font-mono mt-0.5">
                            {tokenPrice.price.toFixed(6)}
                        </div>
                    </div>
                    <div className="bg-slate-900/60 rounded-lg p-2 border border-slate-800/50 text-center">
                        <div className="text-[9px] text-slate-500 uppercase tracking-wider">MCap</div>
                        <div className="text-xs font-bold text-green-400 font-mono mt-0.5">
                            ${tokenPrice.marketCap >= 1000 ? `${(tokenPrice.marketCap / 1000).toFixed(1)}K` : tokenPrice.marketCap.toFixed(0)}
                        </div>
                    </div>
                    <div className="bg-slate-900/60 rounded-lg p-2 border border-slate-800/50 text-center">
                        <div className="text-[9px] text-slate-500 uppercase tracking-wider">Curve</div>
                        <div className="text-xs font-bold text-cyan-400 font-mono mt-0.5">
                            {(tokenPrice.curveProgress * 100).toFixed(1)}%
                        </div>
                    </div>
                </div>
            )}

            {/* Mini curve */}
            {tokenPrice && (
                <div className="bg-slate-950/40 rounded-lg p-2 border border-slate-800/30">
                    <MiniCurve progress={tokenPrice.curveProgress} />
                </div>
            )}

            {/* Tx Result Toast */}
            <AnimatePresence>
                {txResult && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className={`text-xs p-2.5 rounded-lg border ${txResult.type === 'success'
                            ? 'bg-green-500/10 border-green-500/30 text-green-400'
                            : 'bg-red-500/10 border-red-500/30 text-red-400'
                            }`}
                    >
                        {txResult.message}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Buy/Sell Toggle */}
            <div className="flex bg-slate-950 rounded-lg p-1 border border-slate-800">
                <button
                    onClick={() => setMode('buy')}
                    className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${mode === 'buy' ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/20' : 'text-slate-500 hover:text-white'}`}
                >
                    Buy
                </button>
                <button
                    onClick={() => setMode('sell')}
                    className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${mode === 'sell' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'text-slate-500 hover:text-white'}`}
                >
                    Sell
                </button>
            </div>

            {/* Amount Input */}
            <div>
                <div className="flex justify-between text-[11px] text-slate-500 mb-1 px-1">
                    <label>{mode === 'buy' ? 'Amount (tokens)' : 'Amount (tokens)'}</label>
                    <span className="font-mono">≈ {solEstimate.toFixed(4)} SOL</span>
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
            {quoteLoading && (
                <div className="text-[11px] text-slate-500 text-center py-1">Fetching quote...</div>
            )}

            {/* Swap Button */}
            <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSwap}
                disabled={isLoading || !parseFloat(amount) || !selectedToken || !publicKey}
                className={`w-full py-3 rounded-lg font-bold text-sm shadow-xl transition-all uppercase tracking-wider ${isLoading || !parseFloat(amount) || !selectedToken || !publicKey ? 'opacity-50 cursor-not-allowed' : ''} ${mode === 'buy'
                    ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-black shadow-cyan-500/20'
                    : 'bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 text-white shadow-purple-500/20'
                    }`}
            >
                {!publicKey
                    ? 'Connect Wallet'
                    : isLoading
                        ? 'Processing...'
                        : !selectedToken
                            ? 'Select Token'
                            : `${mode === 'buy' ? 'Buy' : 'Sell'} ${selectedToken.symbol}`
                }
            </motion.button>

            {/* View on Bags */}
            {selectedToken && (
                <div className="text-center">
                    <a
                        href={`https://bags.fm/${selectedToken.tokenMint}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
                    >
                        View on bags.fm <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                </div>
            )}
        </div>
    );
};
