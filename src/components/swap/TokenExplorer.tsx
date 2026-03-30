import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, TrendingUp, Star, ExternalLink } from 'lucide-react';
import { tokenService, BagsToken, TokenPrice } from '../../services/TokenService';
import { NDRIFT_TOKEN_ADDRESS } from '../../lib/constants';
import { IS_MAINNET } from '../../services/BlueprintService';
import { useNavigate } from 'react-router-dom';

export const TokenExplorer = () => {
    const navigate = useNavigate();
    const [tokens, setTokens] = useState<BagsToken[]>([]);
    const [prices, setPrices] = useState<Record<string, TokenPrice>>({});
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'launched' | 'pre_launch'>('all');

    useEffect(() => {
        loadTokens();
    }, []);

    const loadTokens = async () => {
        setLoading(true);
        const feed = await tokenService.getTokenFeed();
        setTokens(feed);

        // Fetch prices for all tokens
        const priceMap: Record<string, TokenPrice> = {};
        await Promise.all(feed.map(async (t) => {
            const p = await tokenService.getTokenPrice(t.tokenMint);
            priceMap[t.tokenMint] = p;
        }));
        setPrices(priceMap);
        setLoading(false);
    };

    const filteredTokens = tokens.filter(t => {
        const matchesQuery = !query ||
            t.name.toLowerCase().includes(query.toLowerCase()) ||
            t.symbol.toLowerCase().includes(query.toLowerCase());
        const matchesFilter = filter === 'all' ||
            (filter === 'launched' && t.status === 'LAUNCHED') ||
            (filter === 'pre_launch' && t.status === 'PRE_LAUNCH');
        return matchesQuery && matchesFilter;
    });

    const getInitials = (name: string) => name.slice(0, 2).toUpperCase();

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <TrendingUp className="w-6 h-6 text-cyan-400" />
                        Token Explorer
                    </h2>
                    <p className="text-sm text-slate-400 mt-1">
                        Browse and trade all tokens on Bags.fm
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {!IS_MAINNET && (
                        <span className="text-[9px] font-bold text-yellow-400 bg-yellow-500/10 px-2 py-1 rounded border border-yellow-500/20 uppercase tracking-wider">
                            Devnet Mock Data
                        </span>
                    )}
                </div>
            </div>

            {/* Search + Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search tokens..."
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-900/60 border border-slate-800 rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
                    />
                </div>
                <div className="flex bg-slate-900/60 rounded-xl p-1 border border-slate-800 shrink-0">
                    {([['all', 'All'], ['launched', 'Live'], ['pre_launch', 'Pre-Launch']] as const).map(([key, label]) => (
                        <button
                            key={key}
                            onClick={() => setFilter(key)}
                            className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${filter === key
                                ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                                : 'text-slate-400 hover:text-white border border-transparent'
                                }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Token Grid */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="h-40 rounded-2xl bg-slate-900/40 animate-pulse border border-slate-800/30" />
                    ))}
                </div>
            ) : filteredTokens.length === 0 ? (
                <div className="text-center py-16 text-slate-500">
                    <Search className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p>No tokens found matching "{query}"</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredTokens.map((token, i) => {
                        const price = prices[token.tokenMint];
                        const isFeatured = token.tokenMint === NDRIFT_TOKEN_ADDRESS;

                        return (
                            <motion.div
                                key={token.tokenMint}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                whileHover={{ y: -4, scale: 1.01 }}
                                onClick={() => navigate('/dashboard')}
                                className={`relative p-5 rounded-2xl bg-slate-900/40 backdrop-blur-xl border cursor-pointer transition-all duration-300 group ${isFeatured
                                    ? 'border-cyan-500/30 shadow-[0_0_20px_rgba(0,255,255,0.05)]'
                                    : 'border-slate-800/40 hover:border-slate-700'
                                    }`}
                            >
                                {/* Featured badge */}
                                {isFeatured && (
                                    <div className="absolute -top-2 -right-2 bg-gradient-to-r from-cyan-500 to-purple-500 text-black text-[8px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                        Our Token
                                    </div>
                                )}

                                {/* Top row */}
                                <div className="flex items-start gap-3 mb-4">
                                    {token.image ? (
                                        <img src={token.image} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                                    ) : (
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${isFeatured
                                            ? 'bg-gradient-to-br from-cyan-500/20 to-cyan-400/10 text-cyan-300'
                                            : 'bg-gradient-to-br from-slate-700 to-slate-800 text-slate-400'
                                            }`}>
                                            {getInitials(token.symbol)}
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-bold text-white">{token.symbol}</span>
                                            {isFeatured && <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />}
                                        </div>
                                        <div className="text-xs text-slate-500 truncate">{token.name}</div>
                                    </div>
                                    <div className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${token.status === 'LAUNCHED' ? 'bg-green-500/10 text-green-400' :
                                        token.status === 'GRADUATED' ? 'bg-purple-500/10 text-purple-400' :
                                            'bg-yellow-500/10 text-yellow-400'
                                        }`}>
                                        {token.status === 'PRE_LAUNCH' ? 'Soon' : token.status === 'LAUNCHED' ? 'Live' : 'Graduated'}
                                    </div>
                                </div>

                                {/* Description */}
                                <p className="text-xs text-slate-500 line-clamp-2 mb-4">{token.description}</p>

                                {/* Stats */}
                                {price && (
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="text-center">
                                            <div className="text-[9px] text-slate-600 uppercase">Price</div>
                                            <div className="text-xs font-mono font-bold text-white">{price.price.toFixed(6)}</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-[9px] text-slate-600 uppercase">MCap</div>
                                            <div className="text-xs font-mono font-bold text-green-400">
                                                ${price.marketCap >= 1000 ? `${(price.marketCap / 1000).toFixed(1)}K` : price.marketCap.toFixed(0)}
                                            </div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-[9px] text-slate-600 uppercase">Curve</div>
                                            <div className="text-xs font-mono font-bold text-cyan-400">{(price.curveProgress * 100).toFixed(0)}%</div>
                                        </div>
                                    </div>
                                )}

                                {/* Hover: View on Bags */}
                                <div className="mt-3 pt-3 border-t border-slate-800/30 opacity-0 group-hover:opacity-100 transition-opacity text-center">
                                    <span className="text-[10px] text-slate-500 inline-flex items-center gap-1">
                                        Trade on Dashboard <ExternalLink className="w-2.5 h-2.5" />
                                    </span>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
