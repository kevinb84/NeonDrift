import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ChevronDown, Star, X } from 'lucide-react';
import { tokenService, BagsToken } from '../../services/TokenService';
import { NDRIFT_TOKEN_ADDRESS } from '../../lib/constants';

interface TokenSelectorProps {
    selectedToken: BagsToken | null;
    onSelect: (token: BagsToken) => void;
}

export const TokenSelector = ({ selectedToken, onSelect }: TokenSelectorProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [tokens, setTokens] = useState<BagsToken[]>([]);
    const [loading, setLoading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Fetch tokens on open
    useEffect(() => {
        if (isOpen) {
            inputRef.current?.focus();
            loadTokens();
        }
    }, [isOpen]);

    // Search on query change
    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => loadTokens(), 200);
            return () => clearTimeout(timer);
        }
    }, [query]);

    const loadTokens = async () => {
        setLoading(true);
        const results = await tokenService.searchTokens(query);
        setTokens(results);
        setLoading(false);
    };

    const handleSelect = (token: BagsToken) => {
        onSelect(token);
        setIsOpen(false);
        setQuery('');
    };

    const getInitials = (name: string) => name.slice(0, 2).toUpperCase();
    const isNdrift = (mint: string) => mint === NDRIFT_TOKEN_ADDRESS;

    return (
        <div ref={containerRef} className="relative">
            {/* Selected Token Display */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-800/60 border border-slate-700/50 hover:border-slate-600 transition-all w-full group"
            >
                {selectedToken ? (
                    <>
                        {selectedToken.image ? (
                            <img src={selectedToken.image} alt="" className="w-7 h-7 rounded-full object-cover" />
                        ) : (
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500/30 to-purple-500/30 flex items-center justify-center text-[10px] font-bold text-cyan-300">
                                {getInitials(selectedToken.symbol)}
                            </div>
                        )}
                        <div className="text-left flex-1 min-w-0">
                            <div className="text-sm font-bold text-white truncate">{selectedToken.symbol}</div>
                            <div className="text-[10px] text-slate-500 truncate">{selectedToken.name}</div>
                        </div>
                    </>
                ) : (
                    <div className="text-sm text-slate-400 flex-1 text-left">Select token...</div>
                )}
                <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.96 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-full left-0 right-0 mt-2 z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl shadow-black/50 overflow-hidden"
                    >
                        {/* Search */}
                        <div className="p-2.5 border-b border-slate-800">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                                <input
                                    ref={inputRef}
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search name, symbol or address..."
                                    className="w-full pl-9 pr-8 py-2 text-sm bg-slate-800/60 border border-slate-700/50 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
                                />
                                {query && (
                                    <button onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                                        <X className="w-3.5 h-3.5 text-slate-500 hover:text-white" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Token List */}
                        <div className="max-h-[280px] overflow-y-auto overscroll-contain">
                            {loading ? (
                                <div className="p-6 text-center text-sm text-slate-500">Searching...</div>
                            ) : tokens.length === 0 ? (
                                <div className="p-6 text-center text-sm text-slate-500">
                                    {query ? 'No tokens found' : 'No tokens available'}
                                </div>
                            ) : (
                                tokens.map((token) => {
                                    const isSelected = selectedToken?.tokenMint === token.tokenMint;
                                    const featured = isNdrift(token.tokenMint);

                                    return (
                                        <button
                                            key={token.tokenMint}
                                            onClick={() => handleSelect(token)}
                                            className={`w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-slate-800/60 transition-colors text-left ${isSelected ? 'bg-cyan-500/5 border-l-2 border-cyan-500' : 'border-l-2 border-transparent'
                                                }`}
                                        >
                                            {/* Icon */}
                                            {token.image ? (
                                                <img src={token.image} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                                            ) : (
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${featured
                                                    ? 'bg-gradient-to-br from-cyan-500/30 to-cyan-400/20 text-cyan-300'
                                                    : 'bg-gradient-to-br from-slate-700 to-slate-800 text-slate-400'
                                                    }`}>
                                                    {getInitials(token.symbol)}
                                                </div>
                                            )}

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-sm font-bold text-white">{token.symbol}</span>
                                                    {featured && <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />}
                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${token.status === 'LAUNCHED' ? 'bg-green-500/10 text-green-400' :
                                                        token.status === 'GRADUATED' ? 'bg-purple-500/10 text-purple-400' :
                                                            'bg-yellow-500/10 text-yellow-400'
                                                        }`}>{token.status}</span>
                                                </div>
                                                <div className="text-[11px] text-slate-500 truncate">{token.name}</div>
                                            </div>

                                            {/* Mint preview */}
                                            <div className="text-[10px] text-slate-600 font-mono shrink-0">
                                                {token.tokenMint.slice(0, 4)}…{token.tokenMint.slice(-4)}
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-2 border-t border-slate-800 text-center">
                            <span className="text-[9px] text-slate-600">
                                Tokens on <a href="https://bags.fm" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-slate-400 underline">bags.fm</a>
                            </span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
