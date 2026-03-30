import { FC } from 'react';
import { motion } from 'framer-motion';
import { useLeaderboard } from '../hooks/useLeaderboard';

export const Leaderboard: FC = () => {
    const { leaderboard, loading } = useLeaderboard();

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-gray-900/50 backdrop-blur rounded-xl border border-gray-800 p-6 mt-8"
        >
            <h3 className="text-xl font-bold text-cyan-400 mb-4 flex items-center gap-2">
                <span className="text-2xl">🏆</span> LEADERBOARD
            </h3>

            {loading ? (
                <div className="text-center text-gray-500 py-4">Loading top racers...</div>
            ) : (
                <div className="space-y-3">
                    {leaderboard.length === 0 ? (
                        <div className="text-center text-gray-500">No records yet. Be the first!</div>
                    ) : (
                        leaderboard.map((player, index) => (
                            <div key={player.wallet_address} className="flex items-center justify-between p-2 rounded bg-gray-800/50 border border-gray-700">
                                <div className="flex items-center gap-3">
                                    <span className={`font-mono font-bold w-6 text-center ${index < 3 ? 'text-yellow-400' : 'text-gray-500'}`}>
                                        #{index + 1}
                                    </span>
                                    <span className="text-white text-sm">
                                        {player.username || player.wallet_address.slice(0, 6)}
                                    </span>
                                </div>
                                <div className="text-purple-400 font-bold font-mono">
                                    {player.high_score.toLocaleString()}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </motion.div>
    );
};
