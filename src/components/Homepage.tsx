import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import {
    Play, Zap, Trophy, Users, Ghost, Coins, Shield, ChevronRight,
    Activity, Flame, Gauge, Sparkles, Cpu, BarChart3, Globe, Target,
    TrendingUp, Bot, Layers
} from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { insforge } from '../lib/insforge';
import { useState, useEffect } from 'react';

// ─── Animated Section Wrapper ─────────────────────────────────────
function FadeInSection({ children, className = '', delay = 0 }: {
    children: React.ReactNode; className?: string; delay?: number;
}) {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: '-80px' });

    return (
        <motion.div
            ref={ref}
            initial={{ opacity: 0, y: 40 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay, ease: [0.25, 0.1, 0.25, 1] }}
            className={className}
        >
            {children}
        </motion.div>
    );
}

// ─── Floating Neon Orbs Background ────────────────────────────────
function NeonBackground() {
    return (
        <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
            {/* Base gradient */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#0a0a1a_0%,#000000_70%)]" />

            {/* Animated orbs */}
            <motion.div
                animate={{ x: [0, 30, -20, 0], y: [0, -40, 20, 0] }}
                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                className="absolute top-[10%] left-[15%] w-[500px] h-[500px] rounded-full bg-cyan-500/[0.04] blur-[120px]"
            />
            <motion.div
                animate={{ x: [0, -30, 40, 0], y: [0, 30, -20, 0] }}
                transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
                className="absolute top-[40%] right-[10%] w-[600px] h-[600px] rounded-full bg-purple-500/[0.04] blur-[120px]"
            />
            <motion.div
                animate={{ x: [0, 20, -30, 0], y: [0, -20, 30, 0] }}
                transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
                className="absolute bottom-[10%] left-[30%] w-[400px] h-[400px] rounded-full bg-pink-500/[0.03] blur-[120px]"
            />

            {/* Grid overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px]" />
        </div>
    );
}

// ─── Hero Section ─────────────────────────────────────────────────
function HeroSection() {
    const navigate = useNavigate();
    const ref = useRef(null);
    const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
    const y = useTransform(scrollYProgress, [0, 1], [0, 150]);
    const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

    return (
        <section ref={ref} className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
            {/* Animated glow ring behind title */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
                    className="w-[700px] h-[700px] rounded-full border border-cyan-500/[0.06] relative"
                >
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_20px_rgba(0,255,255,0.8)]" />
                </motion.div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <motion.div
                    animate={{ rotate: -360 }}
                    transition={{ duration: 80, repeat: Infinity, ease: 'linear' }}
                    className="w-[900px] h-[900px] rounded-full border border-purple-500/[0.04] relative"
                >
                    <div className="absolute bottom-0 right-1/4 w-1.5 h-1.5 rounded-full bg-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.8)]" />
                </motion.div>
            </div>

            <motion.div style={{ y, opacity }} className="relative text-center px-4 max-w-5xl mx-auto">
                {/* Pre-title badge */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                    className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/5 text-cyan-400 text-xs font-medium tracking-wider uppercase mb-8"
                >
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" />
                    </span>
                    Built on Solana • Powered by Bags
                </motion.div>

                {/* Title */}
                <motion.h1
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                    className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-black tracking-tighter leading-none mb-6"
                >
                    <span className="bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-white/40">
                        NEON
                    </span>
                    <br />
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-cyan-300 to-purple-400 drop-shadow-[0_0_40px_rgba(0,255,255,0.3)]">
                        DRIFT
                    </span>
                </motion.h1>

                {/* Tagline */}
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="text-2xl sm:text-3xl font-light text-slate-400 tracking-widest uppercase mb-12"
                >
                    Race · Win · <span className="text-cyan-400 font-normal">Earn</span>
                </motion.p>

                {/* CTA Buttons */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                    className="flex flex-col sm:flex-row items-center justify-center gap-4"
                >
                    <motion.button
                        whileHover={{ scale: 1.05, boxShadow: '0 0 40px rgba(0,255,255,0.4)' }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => navigate('/game', { state: { autoStartRanked: true } })}
                        className="group flex items-center gap-3 px-10 py-4 bg-gradient-to-r from-cyan-500 to-cyan-400 text-black font-bold text-lg rounded-xl shadow-[0_0_30px_rgba(0,255,255,0.25)] transition-all"
                    >
                        <Play className="w-6 h-6" fill="currentColor" />
                        Play Ranked
                        <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </motion.button>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => navigate('/game')}
                        className="flex items-center gap-3 px-10 py-4 bg-white/5 backdrop-blur-xl border border-white/10 text-white font-bold text-lg rounded-xl hover:bg-white/10 hover:border-white/20 transition-all"
                    >
                        <Zap className="w-5 h-5 text-purple-400" />
                        Practice
                    </motion.button>
                </motion.div>

                {/* Scroll hint */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.5 }}
                    className="absolute -bottom-20 left-1/2 -translate-x-1/2"
                >
                    <motion.div
                        animate={{ y: [0, 8, 0] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="w-6 h-10 rounded-full border-2 border-white/10 flex items-start justify-center pt-2"
                    >
                        <div className="w-1 h-2 rounded-full bg-white/30" />
                    </motion.div>
                </motion.div>
            </motion.div>
        </section>
    );
}

// ─── How It Works ─────────────────────────────────────────────────
function HowItWorks() {
    const steps = [
        {
            icon: Coins,
            title: 'Stake',
            description: 'Connect your wallet and stake SOL as an entry fee for ranked matches.',
            color: 'cyan',
            glow: 'shadow-[0_0_30px_rgba(0,255,255,0.15)]',
            border: 'border-cyan-500/20 hover:border-cyan-500/40',
            iconBg: 'bg-cyan-500/10',
            iconColor: 'text-cyan-400',
        },
        {
            icon: Gauge,
            title: 'Race',
            description: 'Compete in high-speed 3D races with nitro boosts and drift mechanics.',
            color: 'purple',
            glow: 'shadow-[0_0_30px_rgba(168,85,247,0.15)]',
            border: 'border-purple-500/20 hover:border-purple-500/40',
            iconBg: 'bg-purple-500/10',
            iconColor: 'text-purple-400',
        },
        {
            icon: Trophy,
            title: 'Win',
            description: 'Winner takes the full pot — SOL payouts are settled on-chain instantly.',
            color: 'pink',
            glow: 'shadow-[0_0_30px_rgba(236,72,153,0.15)]',
            border: 'border-pink-500/20 hover:border-pink-500/40',
            iconBg: 'bg-pink-500/10',
            iconColor: 'text-pink-400',
        },
    ];

    return (
        <section className="py-28 px-4">
            <div className="max-w-5xl mx-auto">
                <FadeInSection className="text-center mb-16">
                    <span className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-400/60 mb-3 block">How It Works</span>
                    <h2 className="text-4xl sm:text-5xl font-bold text-white">
                        Three Steps to <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-400">Victory</span>
                    </h2>
                </FadeInSection>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
                    {/* Connection lines */}
                    <div className="hidden md:block absolute top-1/2 left-[17%] right-[17%] h-px bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-pink-500/20 -translate-y-1/2" />

                    {steps.map((step, i) => (
                        <FadeInSection key={step.title} delay={i * 0.15}>
                            <motion.div
                                whileHover={{ y: -8, scale: 1.02 }}
                                className={`relative p-8 rounded-2xl bg-slate-900/50 backdrop-blur-xl border ${step.border} ${step.glow} transition-all duration-500 group`}
                            >
                                {/* Step number */}
                                <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-400">
                                    {i + 1}
                                </div>

                                <div className={`w-14 h-14 rounded-xl ${step.iconBg} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
                                    <step.icon className={`w-7 h-7 ${step.iconColor}`} />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">{step.title}</h3>
                                <p className="text-sm text-slate-400 leading-relaxed">{step.description}</p>
                            </motion.div>
                        </FadeInSection>
                    ))}
                </div>
            </div>
        </section>
    );
}

// ─── Live Activity Section ────────────────────────────────────────
function LiveActivity() {
    const wallet = useWallet();
    const [liveMatches, setLiveMatches] = useState<any[]>([]);
    const [recentWinners, setRecentWinners] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const { data: live } = await insforge.database
                    .from('matches')
                    .select('*')
                    .in('status', ['waiting', 'locked', 'racing'])
                    .order('created_at', { ascending: false })
                    .limit(4);
                setLiveMatches(live || []);

                const { data: winners } = await insforge.database
                    .from('matches')
                    .select('id, entry_fee, winner_wallet, updated_at')
                    .eq('status', 'completed')
                    .not('winner_wallet', 'is', null)
                    .order('updated_at', { ascending: false })
                    .limit(5);
                setRecentWinners(winners || []);
            } catch {
                // silently fail
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
        const interval = setInterval(fetchStats, 15000);
        return () => clearInterval(interval);
    }, []);

    const statusLabel = (s: string) => {
        if (s === 'racing') return { text: 'Racing', color: 'bg-purple-500' };
        if (s === 'locked') return { text: 'Starting', color: 'bg-yellow-500' };
        return { text: 'Waiting', color: 'bg-green-500 animate-pulse' };
    };

    return (
        <section className="py-28 px-4">
            <div className="max-w-5xl mx-auto">
                <FadeInSection className="text-center mb-16">
                    <span className="text-xs font-bold uppercase tracking-[0.3em] text-pink-400/60 mb-3 block">Live Now</span>
                    <h2 className="text-4xl sm:text-5xl font-bold text-white">
                        The Track is <span className="bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-orange-400">Alive</span>
                    </h2>
                </FadeInSection>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Live Matches */}
                    <FadeInSection>
                        <div className="p-6 rounded-2xl bg-slate-900/40 backdrop-blur-xl border border-cyan-500/10">
                            <h3 className="flex items-center gap-2 text-lg font-bold text-cyan-400 mb-5">
                                <Activity className="w-5 h-5 animate-pulse" /> Active Matches
                            </h3>
                            {loading ? (
                                <div className="space-y-3">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="h-14 rounded-xl bg-slate-800/40 animate-pulse" />
                                    ))}
                                </div>
                            ) : liveMatches.length === 0 ? (
                                <div className="text-center py-10 text-slate-500 text-sm">
                                    No active matches right now. Start one!
                                </div>
                            ) : (
                                <div className="space-y-2.5">
                                    {liveMatches.map(m => {
                                        const st = statusLabel(m.status);
                                        return (
                                            <motion.div
                                                key={m.id}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                className="flex items-center justify-between p-3.5 rounded-xl bg-slate-800/30 border border-slate-700/30 hover:border-cyan-500/20 transition-colors"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className={`w-2.5 h-2.5 rounded-full ${st.color}`} />
                                                    <div>
                                                        <div className="text-sm font-semibold text-white">{st.text}</div>
                                                        <div className="text-[11px] text-slate-500 font-mono">{m.id.slice(0, 8)}…</div>
                                                    </div>
                                                </div>
                                                <div className="text-cyan-400 font-bold text-sm">{m.entry_fee} SOL</div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </FadeInSection>

                    {/* Recent Winners */}
                    <FadeInSection delay={0.1}>
                        <div className="p-6 rounded-2xl bg-slate-900/40 backdrop-blur-xl border border-purple-500/10">
                            <h3 className="flex items-center gap-2 text-lg font-bold text-purple-400 mb-5">
                                <Trophy className="w-5 h-5 text-yellow-400" /> Recent Winners
                            </h3>
                            {loading ? (
                                <div className="space-y-3">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="h-14 rounded-xl bg-slate-800/40 animate-pulse" />
                                    ))}
                                </div>
                            ) : recentWinners.length === 0 ? (
                                <div className="text-center py-10 text-slate-500 text-sm">
                                    No winners yet. Be the first champion!
                                </div>
                            ) : (
                                <div className="space-y-2.5">
                                    {recentWinners.map((w, i) => (
                                        <motion.div
                                            key={w.id}
                                            initial={{ opacity: 0, x: 10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.05 }}
                                            className="flex items-center justify-between p-3.5 rounded-xl bg-slate-800/30 border border-slate-700/30 hover:border-purple-500/20 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-orange-600 flex items-center justify-center text-sm shadow-lg">
                                                    🏆
                                                </div>
                                                <div>
                                                    <div className="text-sm font-semibold text-white font-mono">
                                                        {w.winner_wallet === wallet.publicKey?.toBase58()
                                                            ? <span className="text-green-400">You!</span>
                                                            : `${w.winner_wallet.slice(0, 4)}…${w.winner_wallet.slice(-4)}`
                                                        }
                                                    </div>
                                                    <div className="text-[11px] text-slate-500">
                                                        {new Date(w.updated_at).toLocaleTimeString()}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-green-400 font-bold text-sm">+{(w.entry_fee * 2).toFixed(2)} SOL</div>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </FadeInSection>
                </div>
            </div>
        </section>
    );
}

// ─── Features Grid ────────────────────────────────────────────────
function Features() {
    const features = [
        {
            icon: Users,
            title: 'Multiplayer Racing',
            description: 'Real-time 1v1 races with WebSocket synchronization. Feel every drift your opponent makes.',
            gradient: 'from-cyan-500/10 to-blue-500/10',
            iconColor: 'text-cyan-400',
        },
        {
            icon: Flame,
            title: 'Nitro System',
            description: 'Build nitro through clean drifts and deploy it for massive speed boosts at critical moments.',
            gradient: 'from-orange-500/10 to-red-500/10',
            iconColor: 'text-orange-400',
        },
        {
            icon: Ghost,
            title: 'Ghost Replay',
            description: 'Race against your personal best. Every run is recorded and available as a ghost challenge.',
            gradient: 'from-cyan-500/10 to-teal-500/10',
            iconColor: 'text-teal-400',
        },
        {
            icon: Shield,
            title: 'On-Chain Payouts',
            description: 'Winner-take-all micro-matches settled by Solana smart contracts. Trustless, instant, verifiable.',
            gradient: 'from-purple-500/10 to-pink-500/10',
            iconColor: 'text-purple-400',
        },
    ];

    return (
        <section className="py-28 px-4">
            <div className="max-w-5xl mx-auto">
                <FadeInSection className="text-center mb-16">
                    <span className="text-xs font-bold uppercase tracking-[0.3em] text-purple-400/60 mb-3 block">Features</span>
                    <h2 className="text-4xl sm:text-5xl font-bold text-white">
                        Built for <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-cyan-400">Speed</span>
                    </h2>
                </FadeInSection>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {features.map((f, i) => (
                        <FadeInSection key={f.title} delay={i * 0.1}>
                            <motion.div
                                whileHover={{ y: -4 }}
                                className={`p-7 rounded-2xl bg-gradient-to-br ${f.gradient} border border-white/5 hover:border-white/10 backdrop-blur-xl transition-all duration-300 group`}
                            >
                                <div className="flex items-start gap-4">
                                    <div className="w-11 h-11 rounded-lg bg-slate-900/80 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                        <f.icon className={`w-5 h-5 ${f.iconColor}`} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white mb-1.5">{f.title}</h3>
                                        <p className="text-sm text-slate-400 leading-relaxed">{f.description}</p>
                                    </div>
                                </div>
                            </motion.div>
                        </FadeInSection>
                    ))}
                </div>
            </div>
        </section>
    );
}

// ─── Token Section ────────────────────────────────────────────────
function TokenSection() {
    const navigate = useNavigate();

    return (
        <section className="py-28 px-4">
            <div className="max-w-4xl mx-auto">
                <FadeInSection>
                    <div className="relative p-10 sm:p-14 rounded-3xl bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-purple-900/20 border border-purple-500/10 backdrop-blur-xl overflow-hidden">
                        {/* Decorative glow */}
                        <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-purple-500/10 blur-[100px]" />
                        <div className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full bg-cyan-500/10 blur-[100px]" />

                        <div className="relative text-center">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-white/10 mb-6">
                                <Sparkles className="w-8 h-8 text-cyan-400" />
                            </div>

                            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                                $NDRIFT Token
                            </h2>
                            <p className="text-slate-400 max-w-2xl mx-auto mb-8 text-lg leading-relaxed">
                                The in-game currency powering NeonDrift. Use $NDRIFT for discounted match entries,
                                exclusive car upgrades, and access to high-stakes tournaments. Launched on{' '}
                                <span className="text-purple-400 font-medium">Bags.fm</span> with a fair bonding curve.
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                                {[
                                    { label: 'Match Fees', icon: Trophy, desc: 'Discounted entry' },
                                    { label: 'Car Upgrades', icon: Zap, desc: 'On-chain boosts' },
                                    { label: 'Tournaments', icon: Shield, desc: 'Exclusive access' },
                                ].map((item) => (
                                    <div key={item.label} className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                                        <item.icon className="w-5 h-5 text-cyan-400 mx-auto mb-2" />
                                        <div className="text-sm font-bold text-white">{item.label}</div>
                                        <div className="text-xs text-slate-500">{item.desc}</div>
                                    </div>
                                ))}
                            </div>

                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => navigate('/dashboard')}
                                className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-bold rounded-xl shadow-[0_0_30px_rgba(168,85,247,0.2)] hover:shadow-[0_0_40px_rgba(168,85,247,0.3)] transition-all"
                            >
                                <Coins className="w-5 h-5" /> Trade $NDRIFT
                            </motion.button>
                        </div>
                    </div>
                </FadeInSection>
            </div>
        </section>
    );
}

// ─── Roadmap Section ─────────────────────────────────────────────
function Roadmap() {
    const phases = [
        {
            phase: '01',
            label: 'Live',
            title: 'Core Racing',
            color: 'cyan',
            glow: 'rgba(0,255,255,0.2)',
            border: 'border-cyan-500/30',
            cardBg: 'from-cyan-500/[0.07] to-blue-500/[0.04]',
            labelBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
            iconBg: 'bg-cyan-500/10',
            iconColor: 'text-cyan-400',
            lineColor: 'from-cyan-500/40 to-purple-500/20',
            icon: Gauge,
            items: [
                { icon: Users, text: 'Multiplayer racing' },
                { icon: Trophy, text: 'Ranked matches' },
                { icon: Coins, text: 'On-chain payouts' },
                { icon: Ghost, text: 'Ghost replay system' },
            ],
        },
        {
            phase: '02',
            label: 'Coming Soon',
            title: 'Competitive Expansion',
            color: 'purple',
            glow: 'rgba(168,85,247,0.2)',
            border: 'border-purple-500/30',
            cardBg: 'from-purple-500/[0.07] to-pink-500/[0.04]',
            labelBg: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
            iconBg: 'bg-purple-500/10',
            iconColor: 'text-purple-400',
            lineColor: 'from-purple-500/40 to-pink-500/20',
            icon: BarChart3,
            items: [
                { icon: TrendingUp, text: 'Ranking system (ELO)' },
                { icon: Trophy, text: 'Tournaments' },
                { icon: Activity, text: 'Seasonal leaderboard' },
                { icon: Sparkles, text: 'NDRIFT integration' },
            ],
        },
        {
            phase: '03',
            label: 'Planned',
            title: 'AI & Prediction Layer',
            color: 'pink',
            glow: 'rgba(236,72,153,0.2)',
            border: 'border-pink-500/30',
            cardBg: 'from-pink-500/[0.07] to-orange-500/[0.04]',
            labelBg: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
            iconBg: 'bg-pink-500/10',
            iconColor: 'text-pink-400',
            lineColor: 'from-pink-500/40 to-orange-500/20',
            icon: Bot,
            items: [
                { icon: Target, text: 'Prediction markets' },
                { icon: Bot, text: 'AI Analyst Agent for performance insights' },
                { icon: Cpu, text: 'Strategy-based wagering' },
            ],
        },
        {
            phase: '04',
            label: 'Vision',
            title: 'Ecosystem Vision',
            color: 'orange',
            glow: 'rgba(251,146,60,0.2)',
            border: 'border-orange-500/30',
            cardBg: 'from-orange-500/[0.07] to-yellow-500/[0.04]',
            labelBg: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
            iconBg: 'bg-orange-500/10',
            iconColor: 'text-orange-400',
            lineColor: 'from-orange-500/20 to-transparent',
            icon: Globe,
            items: [
                { icon: Layers, text: 'Fully on-chain competitive infrastructure' },
                { icon: Globe, text: 'Cross-game token utility' },
            ],
        },
    ];

    return (
        <section className="py-28 px-4">
            <div className="max-w-6xl mx-auto">
                <FadeInSection className="text-center mb-20">
                    <span className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-400/60 mb-3 block">Roadmap</span>
                    <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
                        Built to{' '}
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400">
                            Evolve
                        </span>
                    </h2>
                    <p className="text-slate-400 max-w-xl mx-auto text-lg">
                        From a racing game to a fully decentralized competitive ecosystem.
                    </p>
                </FadeInSection>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {phases.map((p, i) => (
                        <FadeInSection key={p.phase} delay={i * 0.12}>
                            <motion.div
                                whileHover={{
                                    y: -6,
                                    boxShadow: `0 0 50px ${p.glow}`,
                                }}
                                transition={{ duration: 0.3 }}
                                className={`relative p-7 rounded-2xl bg-gradient-to-br ${p.cardBg} border ${p.border} backdrop-blur-xl overflow-hidden group`}
                            >
                                {/* Phase number watermark */}
                                <div className="absolute -right-4 -bottom-6 text-[120px] font-black text-white/[0.025] select-none leading-none">
                                    {p.phase}
                                </div>

                                {/* Glow orb */}
                                <motion.div
                                    animate={{ opacity: [0.4, 0.7, 0.4] }}
                                    transition={{ duration: 3, repeat: Infinity, delay: i * 0.5 }}
                                    className="absolute -top-10 -right-10 w-40 h-40 rounded-full blur-[60px]"
                                    style={{ background: p.glow }}
                                />

                                <div className="relative">
                                    {/* Header row */}
                                    <div className="flex items-start justify-between mb-5">
                                        <div className={`w-12 h-12 rounded-xl ${p.iconBg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                                            <p.icon className={`w-6 h-6 ${p.iconColor}`} />
                                        </div>
                                        <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${p.labelBg}`}>
                                            {p.label}
                                        </span>
                                    </div>

                                    <div className="mb-1 text-xs font-mono text-slate-500 tracking-widest">PHASE {p.phase}</div>
                                    <h3 className="text-xl font-bold text-white mb-5">{p.title}</h3>

                                    {/* Items */}
                                    <ul className="space-y-2.5">
                                        {p.items.map((item, j) => (
                                            <motion.li
                                                key={item.text}
                                                initial={{ opacity: 0, x: -10 }}
                                                whileInView={{ opacity: 1, x: 0 }}
                                                viewport={{ once: true }}
                                                transition={{ delay: i * 0.1 + j * 0.06 }}
                                                className="flex items-center gap-3 text-sm text-slate-300"
                                            >
                                                <div className={`w-7 h-7 rounded-lg ${p.iconBg} flex items-center justify-center shrink-0`}>
                                                    <item.icon className={`w-3.5 h-3.5 ${p.iconColor}`} />
                                                </div>
                                                {item.text}
                                            </motion.li>
                                        ))}
                                    </ul>
                                </div>
                            </motion.div>
                        </FadeInSection>
                    ))}
                </div>
            </div>
        </section>
    );
}

// ─── Final CTA ────────────────────────────────────────────────────
function FinalCTA() {
    const navigate = useNavigate();

    return (
        <section className="py-32 px-4 text-center">
            <FadeInSection>
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6 }}
                >
                    <h2 className="text-5xl sm:text-6xl md:text-7xl font-black text-white mb-6 tracking-tight">
                        Ready to{' '}
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-400">
                            Race
                        </span>
                        ?
                    </h2>
                    <p className="text-lg text-slate-400 max-w-xl mx-auto mb-10">
                        Connect your wallet, stake SOL, and prove you're the fastest on the neon grid.
                    </p>
                    <motion.button
                        whileHover={{ scale: 1.05, boxShadow: '0 0 60px rgba(0,255,255,0.3)' }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => navigate('/game', { state: { autoStartRanked: true } })}
                        className="inline-flex items-center gap-3 px-14 py-5 bg-gradient-to-r from-cyan-500 to-cyan-400 text-black font-bold text-xl rounded-2xl shadow-[0_0_40px_rgba(0,255,255,0.25)] transition-all"
                    >
                        <Play className="w-7 h-7" fill="currentColor" />
                        Play Now
                    </motion.button>
                </motion.div>
            </FadeInSection>
        </section>
    );
}

// ─── Homepage Export ──────────────────────────────────────────────
export const Homepage = () => {
    return (
        <div className="relative -mx-4 sm:-mx-6 lg:-mx-8 -mt-8">
            <NeonBackground />
            <HeroSection />
            <HowItWorks />
            <LiveActivity />
            <Features />
            <TokenSection />
            <Roadmap />
            <FinalCTA />
        </div>
    );
};
