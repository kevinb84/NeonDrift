import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Gamepad2, Trophy, Zap, Play, Activity, Ghost } from 'lucide-react';
import { insforge } from '../lib/insforge';
import { useWallet } from '@solana/wallet-adapter-react';

export const MatchHub = () => {
    const navigate = useNavigate();
    const wallet = useWallet();
    const [liveMatches, setLiveMatches] = useState<any[]>([]);
    const [recentWinners, setRecentWinners] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [ghostLoading, setGhostLoading] = useState(false);

    const handleRaceGhost = async () => {
        if (!wallet.publicKey) return;
        setGhostLoading(true);
        try {
            // List all replays for this wallet and find the best (fastest) one
            const walletStr = wallet.publicKey.toBase58();
            const { data: listResult } = await insforge.storage.from('replays').list({ search: walletStr });

            const files = listResult?.objects;

            if (!files || files.length === 0) {
                alert('No ghost replays found! Complete a race first to create one.');
                setGhostLoading(false);
                return;
            }

            // Download the first (most recent) replay
            const firstFile = files[0];
            const { data: blob } = await insforge.storage.from('replays').download(firstFile.key);
            if (!blob) {
                alert('Could not download ghost replay.');
                setGhostLoading(false);
                return;
            }

            const text = await blob.text();
            const replayData = JSON.parse(text);

            // Navigate to game with the ghost replay data
            navigate('/game', { state: { ghostReplayData: replayData } });
        } catch (err) {
            console.error('Failed to load ghost:', err);
            alert('Error loading ghost replay.');
        } finally {
            setGhostLoading(false);
        }
    };

    useEffect(() => {
        const fetchStats = async () => {
            try {
                // Fetch active matches
                const { data: live } = await insforge.database
                    .from('matches')
                    .select('*')
                    .in('status', ['waiting', 'locked', 'racing'])
                    .order('created_at', { ascending: false })
                    .limit(4);
                
                setLiveMatches(live || []);

                // Fetch recent winners
                const { data: winners } = await insforge.database
                    .from('matches')
                    .select('id, entry_fee, winner_wallet, updated_at')
                    .eq('status', 'completed')
                    .not('winner_wallet', 'is', null)
                    .order('updated_at', { ascending: false })
                    .limit(4);

                setRecentWinners(winners || []);
            } catch (err) {
                console.error("Failed to fetch hub stats:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
        // Simple polling every 10s for stats (could use realtime)
        const int = setInterval(fetchStats, 10000);
        return () => clearInterval(int);
    }, []);

    return (
        <div className="space-y-6">
            {/* HERO SECTION */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-900/40 via-purple-900/40 to-slate-900/40 border border-primary/20 p-8 sm:p-12 text-center shadow-[0_0_40px_rgba(0,255,255,0.1)]">
                <div className="absolute top-0 right-0 p-8 opacity-10 blur-[2px]">
                    <Gamepad2 size={200} />
                </div>
                
                <h1 className="relative text-4xl sm:text-5xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-cyan-400 to-purple-500 mb-4 font-mono uppercase tracking-widest drop-shadow-[0_0_10px_rgba(0,255,255,0.5)]">
                    Neon Drift
                </h1>
                <p className="relative text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto mb-8">
                    High-speed futuristic racing on the Solana blockchain. 
                    Stake Neon, challenge opponents, and dominate the global leaderboards.
                </p>
                
                <div className="relative flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Button 
                        size="lg" 
                        onClick={() => navigate('/game', { state: { autoStartRanked: true } })}
                        className="w-full sm:w-auto bg-primary text-black hover:bg-primary/90 font-bold text-lg px-8 py-6 shadow-[0_0_20px_rgba(0,255,255,0.4)] transition-all hover:scale-105"
                    >
                        <Play className="w-6 h-6 mr-2" fill="currentColor" /> Play Ranked
                    </Button>
                    <Button 
                        size="lg" 
                        variant="secondary"
                        onClick={() => navigate('/game')}
                        className="w-full sm:w-auto text-lg px-8 py-6 border border-slate-600 hover:border-slate-400 bg-slate-800/50 hover:bg-slate-700/50 transition-all"
                    >
                        <Zap className="w-5 h-5 mr-2" /> Practice Mode
                    </Button>
                    <Button 
                        size="lg" 
                        variant="secondary"
                        onClick={handleRaceGhost}
                        disabled={ghostLoading || !wallet.publicKey}
                        className="w-full sm:w-auto text-lg px-8 py-6 border border-cyan-600/40 hover:border-cyan-400 bg-cyan-950/30 hover:bg-cyan-900/40 transition-all text-cyan-300"
                    >
                        <Ghost className="w-5 h-5 mr-2" /> {ghostLoading ? 'Loading...' : 'Race Ghost'}
                    </Button>
                </div>
            </div>

            {/* LIVE DATA GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Live Matches */}
                <Card glass className="border-cyan-500/20 bg-slate-900/60">
                    <CardContent className="p-6">
                        <h3 className="text-xl font-bold flex items-center gap-2 mb-4 text-cyan-400">
                            <Activity className="animate-pulse" /> Live Matches
                        </h3>
                        {loading ? (
                            <div className="animate-pulse flex flex-col gap-3">
                                {[1,2,3].map(i => <div key={i} className="h-12 bg-slate-800/50 rounded-lg"></div>)}
                            </div>
                        ) : liveMatches.length === 0 ? (
                            <div className="text-center py-8 text-slate-500">
                                No active matches. Be the first to create one!
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {liveMatches.map((m) => (
                                    <div key={m.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/40 border border-slate-700/50 hover:border-cyan-500/30 transition-colors">
                                        <div>
                                            <div className="text-xs text-slate-500 font-mono">ID: {m.id.slice(0, 8)}...</div>
                                            <div className="text-sm font-semibold flex items-center gap-2 mt-1">
                                                <span className={`w-2 h-2 rounded-full ${m.status === 'racing' ? 'bg-purple-500' : 'bg-green-500 animate-pulse'}`}></span>
                                                {m.status === 'locked' ? 'Starting...' : m.status === 'waiting' ? 'Waiting for Player...' : 'Racing In Progress'}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-cyan-400 font-bold">{m.entry_fee} Neon 💰</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Recent Winners */}
                <Card glass className="border-purple-500/20 bg-slate-900/60">
                    <CardContent className="p-6">
                        <h3 className="text-xl font-bold flex items-center gap-2 mb-4 text-purple-400">
                            <Trophy className="text-yellow-400" fill="currentColor" /> Recent Big Winners
                        </h3>
                        {loading ? (
                            <div className="animate-pulse flex flex-col gap-3">
                                {[1,2,3].map(i => <div key={i} className="h-12 bg-slate-800/50 rounded-lg"></div>)}
                            </div>
                        ) : recentWinners.length === 0 ? (
                            <div className="text-center py-8 text-slate-500">
                                No recent races completed yet.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {recentWinners.map((w) => (
                                    <div key={w.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/40 border border-slate-700/50 hover:border-purple-500/30 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-orange-600 flex items-center justify-center shadow-lg">
                                                🥇
                                            </div>
                                            <div>
                                                <div className="text-sm font-mono text-slate-300">
                                                    {w.winner_wallet === wallet.publicKey?.toBase58() ? (
                                                        <span className="text-green-400 font-bold">YOU (Winner!)</span>
                                                    ) : (
                                                        w.winner_wallet.slice(0, 4) + '...' + w.winner_wallet.slice(-4)
                                                    )}
                                                </div>
                                                <div className="text-xs text-slate-500 mt-0.5">
                                                    {(new Date(w.updated_at)).toLocaleTimeString()}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-green-400 font-extrabold">+{w.entry_fee * 2} Neon</div>
                                            <div className="text-xs text-slate-500">Won</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

            </div>
        </div>
    );
};
