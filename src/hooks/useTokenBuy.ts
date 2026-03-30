import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Transaction, VersionedTransaction } from '@solana/web3.js';
import { useState } from 'react';
import { insforge } from '../lib/insforge';

export function useTokenBuy() {
    const { connection } = useConnection();
    const { publicKey, sendTransaction } = useWallet();
    const [isBuying, setIsBuying] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const buyToken = async (tokenAddress: string, amount: number) => {
        if (!publicKey) {
            setError("Wallet not connected");
            return false;
        }

        setIsBuying(true);
        setError(null);

        try {
            // 1. Get Unsigned Transaction from InsForge Edge Function
            const res = await insforge.functions.invoke('buy-token', {
                body: {
                    tokenAddress,
                    amount,
                    buyerAddress: publicKey.toBase58(),
                    slippage: 0.5
                }
            });

            if (res.error) throw new Error(res.error.message || "Failed to fetch transaction from server");

            const data = res.data;
            if (!data.transaction) {
                throw new Error("No transaction returned from the server.");
            }

            // 2. Deserialize Transaction
            // bags.fm typically returns a base64 encoded transaction
            const txBuffer = Buffer.from(data.transaction, 'base64');
            let transaction: Transaction | VersionedTransaction;

            try {
                transaction = VersionedTransaction.deserialize(txBuffer);
            } catch (e) {
                transaction = Transaction.from(txBuffer);
            }

            // 3. Send and Sign the Transaction using Wallet Provider
            const signature = await sendTransaction(transaction, connection);

            // 4. Await Confirmation
            const latestBlockhash = await connection.getLatestBlockhash('confirmed');
            const confirmation = await connection.confirmTransaction({
                signature,
                blockhash: latestBlockhash.blockhash,
                lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
            }, 'confirmed');

            if (confirmation.value.err) {
                throw new Error("Transaction failed on-chain.");
            }

            // 5. Verify Transaction via Backend
            // (We will implement verify-transaction.js to securely update profiles)
            const verifyRes = await insforge.functions.invoke('verify-transaction', {
                body: { signature, buyerAddress: publicKey.toBase58() }
            });

            if (verifyRes.error) {
                throw new Error("Transaction confirmed but backend verification failed.");
            }

            setIsBuying(false);
            return true;
        } catch (err: any) {
            console.error("Buy token error:", err);
            setError(err.message || "An unknown error occurred");
            setIsBuying(false);
            return false;
        }
    };

    return { buyToken, isBuying, error };
}
