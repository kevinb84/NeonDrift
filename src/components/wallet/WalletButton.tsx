
import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

import { Button } from '../ui/Button';
import { LogOut, ChevronDown, Copy, ExternalLink } from 'lucide-react';
import { IS_MAINNET } from '../../services/BlueprintService';
import { AnimatePresence, motion } from 'framer-motion';

import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export const WalletButton = () => {
    const { publicKey, disconnect, connected } = useWallet();

    const [isOpen, setIsOpen] = useState(false);

    const base58 = publicKey?.toBase58();
    const shortAddress = base58 ? `${base58.slice(0, 4)}...${base58.slice(-4)}` : '';

    if (!connected) {
        return (
            <div className="flex gap-2">
                <WalletMultiButton />
                {/* 
                <Button
                    onClick={() => {
                        console.log("WalletButton clicked (Disconnected State)");
                        setVisible(true);
                    }}
                    variant="primary"
                    isLoading={connecting}
                    className="shadow-lg shadow-blue-500/20"
                >
                    <Wallet className="mr-2 h-4 w-4" />
                    Connect Wallet
                </Button>
                */}
            </div>
        );
    }

    return (
        <div className="relative">
            <Button
                variant="secondary"
                onClick={() => setIsOpen(!isOpen)}
                className="border-slate-700 bg-slate-900/50 backdrop-blur-md"
            >
                <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    <span>{shortAddress}</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </Button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-700 bg-slate-900 shadow-xl backdrop-blur-xl z-50 p-2"
                    >
                        <div className="mb-2 px-2 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            Wallet
                        </div>

                        <button
                            className="flex w-full items-center rounded-lg px-2 py-2 text-sm text-slate-200 hover:bg-slate-800 transition-colors"
                            onClick={() => {
                                navigator.clipboard.writeText(base58!);
                                setIsOpen(false);
                            }}
                        >
                            <Copy className="mr-2 h-4 w-4 text-slate-400" />
                            Copy Address
                        </button>

                        <a
                            href={`https://solscan.io/account/${base58}${!IS_MAINNET ? '?cluster=devnet' : ''}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex w-full items-center rounded-lg px-2 py-2 text-sm text-slate-200 hover:bg-slate-800 transition-colors"
                            onClick={() => setIsOpen(false)}
                        >
                            <ExternalLink className="mr-2 h-4 w-4 text-slate-400" />
                            View on Explorer
                        </a>

                        <div className="my-1 h-px bg-slate-800" />

                        <button
                            className="flex w-full items-center rounded-lg px-2 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                            onClick={() => {
                                disconnect();
                                setIsOpen(false);
                            }}
                        >
                            <LogOut className="mr-2 h-4 w-4" />
                            Disconnect
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
