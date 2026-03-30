import { FC } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import { motion } from 'framer-motion';
import { useProfile } from '../hooks/useProfile';
import { useTokenBalance } from '../hooks/useTokenBalance';
import { Leaderboard } from './Leaderboard';

interface LandingPageProps {
    onPlay: () => void;
}

export const LandingPage: FC<LandingPageProps> = ({ onPlay }) => {
    const { connected } = useWallet();
    const { profile, loading } = useProfile();
    const { balance } = useTokenBalance();

    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center relative overflow-hidden">
            {/* Background gradients */}
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-900/40 via-black to-black -z-10" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyan-500/10 blur-[120px] rounded-full -z-10" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="text-center z-10 w-full max-w-4xl px-4"
            >
                <h1 className="text-7xl font-bold mb-4 bg-gradient-to-r from-cyan-400 to-purple-500 text-transparent bg-clip-text drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]">
                    NEON DRIFT
                </h1>
                <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
                    High-octane 2D racing powered by the Bags Blueprint bonding curve token engine.
                    Race, upgrade, and earn NDRIFT.
                </p>

                {connected && profile && (
                    <div className="mb-8 p-4 bg-gray-900/50 backdrop-blur rounded-xl border border-gray-800 inline-block">
                        <div className="text-cyan-400 text-lg font-bold">
                            {profile.username || 'Racer'}
                        </div>
                        <div className="text-sm text-gray-400">
                            Balance: <span className="text-white">{balance.toLocaleString()} NDRIFT</span>
                        </div>
                        <div className="text-xs text-purple-400 mt-1">
                            High Score: {profile.high_score}
                        </div>
                    </div>
                )}

                <div className="flex flex-col items-center gap-6">
                    <div className="transform scale-125">
                        <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700 !transition-all !rounded-xl !px-8 !py-4" />
                    </div>

                    {connected && (
                        <motion.button
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={onPlay}
                            className="mt-4 px-12 py-4 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xl rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.6)] transition-all"
                        >
                            {loading ? 'LOADING PROFILE...' : 'ENTER RACE'}
                        </motion.button>
                    )}

                    {!connected && (
                        <p className="text-sm text-gray-500 mt-4">
                            Connect your Solana wallet to enter the grid.
                        </p>
                    )}

                    <div className="w-full flex justify-center">
                        <Leaderboard />
                    </div>
                </div>
            </motion.div>
        </div>
    );
};
