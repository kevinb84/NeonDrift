import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useCallback, useEffect, useState, useRef } from 'react';
import { blueprintService, BlueprintState, TradeQuote, IS_MAINNET } from '../services/BlueprintService';
import { NDRIFT_TOKEN_ADDRESS } from '../lib/constants';

export const useBlueprint = () => {
    const { connection } = useConnection();
    const { publicKey, signTransaction, sendTransaction } = useWallet();

    const [curveState, setCurveState] = useState<BlueprintState | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [slippage, setSlippage] = useState(0.5); // default 0.5%
    const [quote, setQuote] = useState<TradeQuote | null>(null);
    const [quoteLoading, setQuoteLoading] = useState(false);
    const quoteDebounce = useRef<ReturnType<typeof setTimeout>>();

    // ── Refresh curve state ──────────────────────────────────────
    const refreshState = useCallback(async () => {
        try {
            const state = await blueprintService.getCurveState(NDRIFT_TOKEN_ADDRESS);
            setCurveState(state);
            setError(null);
        } catch (e: any) {
            console.warn('Failed to fetch curve state:', e);
        }
    }, []);

    // Initial fetch + polling
    useEffect(() => {
        refreshState();
        const interval = setInterval(refreshState, IS_MAINNET ? 10000 : 30000);
        return () => clearInterval(interval);
    }, [refreshState]);

    // ── Fetch trade quote (debounced) ────────────────────────────
    const fetchQuote = useCallback(async (amount: number, action: 'buy' | 'sell') => {
        if (quoteDebounce.current) clearTimeout(quoteDebounce.current);

        if (!amount || amount <= 0) {
            setQuote(null);
            return;
        }

        quoteDebounce.current = setTimeout(async () => {
            setQuoteLoading(true);
            try {
                const q = await blueprintService.getTradeQuote(NDRIFT_TOKEN_ADDRESS, amount, action);
                setQuote(q);
            } catch {
                setQuote(null);
            } finally {
                setQuoteLoading(false);
            }
        }, 300);
    }, []);

    // ── Buy ──────────────────────────────────────────────────────
    const buy = useCallback(async (amount: number) => {
        if (!publicKey || !signTransaction) throw new Error('Wallet not connected');

        if (!IS_MAINNET) {
            setIsLoading(true);
            await new Promise(r => setTimeout(r, 1500));
            setIsLoading(false);
            return { success: true, message: 'DEVNET MOCK: Buy simulated successfully' };
        }

        setIsLoading(true);
        setError(null);
        try {
            const tx = await blueprintService.buildBuyTransaction(NDRIFT_TOKEN_ADDRESS, publicKey, amount, slippage);
            const signature = await sendTransaction(tx, connection);
            const latestBlockhash = await connection.getLatestBlockhash();
            await connection.confirmTransaction({
                signature,
                blockhash: latestBlockhash.blockhash,
                lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
            });
            await refreshState();
            return { success: true, message: 'Purchase successful!', signature };
        } catch (e: any) {
            console.error(e);
            setError(e);
            throw e;
        } finally {
            setIsLoading(false);
        }
    }, [publicKey, connection, sendTransaction, refreshState, signTransaction, slippage]);

    // ── Sell ─────────────────────────────────────────────────────
    const sell = useCallback(async (amount: number) => {
        if (!publicKey || !signTransaction) throw new Error('Wallet not connected');

        if (!IS_MAINNET) {
            setIsLoading(true);
            await new Promise(r => setTimeout(r, 1500));
            setIsLoading(false);
            return { success: true, message: 'DEVNET MOCK: Sell simulated successfully' };
        }

        setIsLoading(true);
        setError(null);
        try {
            const tx = await blueprintService.buildSellTransaction(NDRIFT_TOKEN_ADDRESS, publicKey, amount, slippage);
            const signature = await sendTransaction(tx, connection);
            const latestBlockhash = await connection.getLatestBlockhash();
            await connection.confirmTransaction({
                signature,
                blockhash: latestBlockhash.blockhash,
                lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
            });
            await refreshState();
            return { success: true, message: 'Sale successful!', signature };
        } catch (e: any) {
            console.error(e);
            setError(e);
            throw e;
        } finally {
            setIsLoading(false);
        }
    }, [publicKey, connection, sendTransaction, refreshState, signTransaction, slippage]);

    // ── Create Token ─────────────────────────────────────────────
    const createToken = useCallback(async (
        name: string,
        symbol: string,
        image: string,
        description: string,
        socials: { twitter?: string; website?: string; telegram?: string },
        initialBuyLamports: number,
    ) => {
        if (!publicKey) throw new Error('Wallet not connected');
        setIsLoading(true);
        setError(null);
        try {
            const signAndSendTx = async (tx: any): Promise<string> => {
                if (!signTransaction) throw new Error('Wallet does not support signing');
                const signedTx = await signTransaction(tx);
                const rawTx = signedTx.serialize();
                const signature = await connection.sendRawTransaction(rawTx, {
                    skipPreflight: true,
                    preflightCommitment: 'confirmed',
                });
                const latestBlockhash = await connection.getLatestBlockhash();
                await connection.confirmTransaction({
                    signature,
                    blockhash: latestBlockhash.blockhash,
                    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
                });
                return signature;
            };

            const result = await blueprintService.createToken(
                publicKey, name, symbol, image, description, socials, initialBuyLamports, signAndSendTx
            );

            if (!result.success) {
                throw new Error(result.error || 'Token creation failed');
            }

            return result;
        } catch (e: any) {
            console.error(e);
            setError(e);
            throw e;
        } finally {
            setIsLoading(false);
        }
    }, [publicKey, connection, sendTransaction, signTransaction]);

    return {
        buy,
        sell,
        createToken,
        curveState,
        price: curveState?.price || 0,
        supply: curveState?.supply || 0,
        marketCap: curveState?.marketCap || 0,
        curveProgress: curveState?.curveProgress || 0,
        isLoading,
        error,
        isMainnet: IS_MAINNET,
        // Slippage
        slippage,
        setSlippage,
        // Quote
        quote,
        quoteLoading,
        fetchQuote,
    };
};
