import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { useWallet } from '@solana/wallet-adapter-react';
import { Loader2, Medal, Activity, Watch, Target, Gamepad2, Camera } from 'lucide-react';
import { insforge } from '../lib/insforge';
import { useProfile } from '../hooks/useProfile';

export const Profile = () => {
    const { publicKey } = useWallet();
    const { profile, refetch } = useProfile();
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [recentMatches, setRecentMatches] = useState<any[]>([]);
    const [stats, setStats] = useState({
        totalRaces: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        totalEarnings: 0,
        rank: 'Bronze',
        rankColor: 'text-amber-600'
    });

    useEffect(() => {
        const fetchStats = async () => {
            if (!publicKey) return;
            const walletStr = publicKey.toBase58();
            try {
                // Fetch matches where user was either creator or opponent and match is completed
                const { data: matches } = await insforge.database
                    .from('matches')
                    .select('*')
                    .eq('status', 'completed')
                    .or(`creator_wallet.eq.${walletStr},opponent_wallet.eq.${walletStr}`)
                    .order('updated_at', { ascending: false })
                    .limit(10); // get last 10 matches for history

                if (matches) {
                    setRecentMatches(matches);
                    const totalRaces = matches.length;
                    const wins = matches.filter(m => m.winner_wallet === walletStr).length;
                    const losses = totalRaces - wins;
                    const winRate = totalRaces > 0 ? (wins / totalRaces) * 100 : 0;
                    
                    const totalEarnings = matches
                        .filter(m => m.winner_wallet === walletStr)
                        .reduce((sum, m) => sum + (m.entry_fee * 2), 0); // Winner takes pot

                    let rank = 'Bronze';
                    let rankColor = 'text-amber-600';
                    if (wins >= 20) { rank = 'Diamond'; rankColor = 'text-cyan-400'; }
                    else if (wins >= 10) { rank = 'Gold'; rankColor = 'text-yellow-400'; }
                    else if (wins >= 5) { rank = 'Silver'; rankColor = 'text-slate-300'; }

                    setStats({ totalRaces, wins, losses, winRate, totalEarnings, rank, rankColor });
                }
            } catch (err) {
                console.error("Failed to fetch profile stats:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, [publicKey]);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        try {
            if (!e.target.files || e.target.files.length === 0 || !publicKey) return;
            const file = e.target.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `${publicKey.toBase58()}-${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;
            
            setUploading(true);

            const { error: uploadError } = await insforge.storage
                .from('avatars')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const publicUrl = insforge.storage
                .from('avatars')
                .getPublicUrl(filePath);

            if (!publicUrl) throw new Error("Could not get public URL");

            const { error: updateError } = await insforge.database
                .from('profiles')
                .update({ avatar_url: publicUrl })
                .eq('wallet_address', publicKey.toBase58());
                
            if (updateError) throw updateError;
            
            await refetch();
        } catch (error) {
            console.error("Error uploading image:", error);
            alert("Error uploading image!");
        } finally {
            setUploading(false);
        }
    };

    if (!publicKey) {
        return (
            <div className="flex flex-col items-center justify-center py-32 text-slate-400 space-y-4">
                <Target size={64} className="opacity-20" />
                <p className="text-xl font-bold font-mono uppercase tracking-widest text-slate-500">
                    Connect Wallet to View Identity
                </p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex justify-center py-32">
                <Loader2 className="animate-spin text-cyan-400" size={48} />
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            
            {/* Identity Banner */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 border border-slate-700 p-8 shadow-2xl">
                <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                    {/* Avatar Display & Upload */}
                    <div className="w-32 h-32 rounded-full bg-slate-950 border-4 border-cyan-500 shadow-[0_0_30px_rgba(0,255,255,0.3)] flex items-center justify-center relative overflow-hidden group">
                        {profile?.avatar_url ? (
                            <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                            <>
                                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-purple-500/20"></div>
                                <Gamepad2 size={48} className="text-cyan-400 opacity-80" />
                            </>
                        )}
                        
                        {/* Hover Overlay for Upload */}
                        <label className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
                            {uploading ? <Loader2 className="animate-spin text-white" size={24} /> : <Camera className="text-white" size={24} />}
                        </label>
                    </div>
                    
                    <div className="flex-1 text-center md:text-left space-y-2">
                        <div className="inline-block px-3 py-1 rounded bg-black/50 border border-slate-700 font-mono text-xs text-slate-400 mb-2">
                            {publicKey.toBase58()}
                        </div>
                        <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">
                            {profile?.username || 'Anonymous Racer'}
                        </h1>
                        <div className="flex items-center justify-center md:justify-start gap-3 mt-4">
                            <span className={`px-4 py-1.5 rounded-full font-bold uppercase tracking-wider text-sm border bg-black/50 overflow-hidden shadow-lg ${stats.rankColor} border-current`}>
                                Rank: {stats.rank}
                            </span>
                            <span className="px-3 py-1.5 rounded bg-green-500/10 text-green-400 border border-green-500/20 font-bold font-mono text-sm shadow-lg">
                                +{stats.totalEarnings.toFixed(2)} SOL
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Win Record */}
                <Card glass className="md:col-span-2 border-slate-700/50 bg-slate-900/40">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-white">
                            <Medal className="text-cyan-400" /> Competitive Record
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div className="bg-black/40 p-4 rounded-xl border border-slate-800 flex flex-col items-center justify-center text-center">
                                <span className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Total Races</span>
                                <span className="text-3xl font-bold font-mono text-white">{stats.totalRaces}</span>
                            </div>
                            <div className="bg-black/40 p-4 rounded-xl border border-green-900/30 flex flex-col items-center justify-center text-center">
                                <span className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Wins</span>
                                <span className="text-3xl font-bold font-mono text-green-400">{stats.wins}</span>
                            </div>
                            <div className="bg-black/40 p-4 rounded-xl border border-red-900/30 flex flex-col items-center justify-center text-center">
                                <span className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Losses</span>
                                <span className="text-3xl font-bold font-mono text-red-400">{stats.losses}</span>
                            </div>
                            <div className="bg-black/40 p-4 rounded-xl border border-cyan-900/30 flex flex-col items-center justify-center text-center">
                                <span className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Win Rate</span>
                                <span className="text-3xl font-bold font-mono text-cyan-400">{stats.winRate.toFixed(1)}%</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Best Times */}
                <Card glass className="md:col-span-1 border-slate-700/50 bg-slate-900/40">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-white">
                            <Watch className="text-purple-400" /> Best Times
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex justify-between items-center p-3 rounded bg-black/40 border border-slate-800">
                            <span className="text-sm font-semibold text-slate-300">Neon Circuit</span>
                            <span className="font-mono text-purple-400 font-bold">01:24.500</span>
                        </div>
                        <div className="flex justify-between items-center p-3 rounded bg-black/40 border border-slate-800">
                            <span className="text-sm font-semibold text-slate-300">Cyber City</span>
                            <span className="font-mono text-slate-500 italic">Unranked</span>
                        </div>
                        <div className="flex justify-between items-center p-3 rounded bg-black/40 border border-slate-800">
                            <span className="text-sm font-semibold text-slate-300">Desert Ruins</span>
                            <span className="font-mono text-slate-500 italic">Unranked</span>
                        </div>
                    </CardContent>
                </Card>
            </div>
            
            {/* Recent Match History */}
            <Card glass className="border-slate-700/50 bg-slate-900/40">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                        <Activity className="text-yellow-400" /> Recent Matches
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {!recentMatches || recentMatches.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-slate-500">
                            <p className="font-mono text-sm">No recorded matches found.</p>
                        </div>
                    ) : (
                        <div className="space-y-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                            {recentMatches.map((match) => {
                                const isCreator = match.creator_wallet === publicKey?.toBase58();
                                const isWinner = match.winner_wallet === publicKey?.toBase58();
                                const opponentLabel = isCreator 
                                    ? (match.opponent_username || match.opponent_wallet?.slice(0,6) || "Unknown")
                                    : (match.creator_username || match.creator_wallet?.slice(0,6) || "Unknown");
                                
                                const dateStr = new Date(match.updated_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                                
                                return (
                                    <div key={match.id} className="flex flex-col sm:flex-row justify-between items-center bg-black/40 border border-slate-800 p-4 rounded-xl hover:border-slate-600 transition-colors">
                                        
                                        <div className="flex flex-col items-center sm:items-start mb-2 sm:mb-0">
                                            <span className="text-xs text-slate-500 shadow-sm mb-1">{dateStr}</span>
                                            <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                                                <span>vs</span>
                                                <span className="text-cyan-400 font-mono tracking-wider">{opponentLabel}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            {isWinner ? (
                                                <span className="px-3 py-1 rounded-sm bg-green-500/20 text-green-400 font-bold border border-green-500/30 text-xs tracking-wider">
                                                    VICTORY (+{(match.entry_fee * 2).toFixed(2)} SOL)
                                                </span>
                                            ) : (
                                                <span className="px-3 py-1 rounded-sm bg-red-500/10 text-red-400 font-bold border border-red-500/20 text-xs tracking-wider">
                                                    DEFEAT (-{match.entry_fee} SOL)
                                                </span>
                                            )}
                                        </div>

                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

        </div>
    );
};
