import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useEffect, useState, useCallback } from 'react';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

// TODO: Replace with actual NDRIFT Mint Address once deployed
const NDRIFT_MINT_ADDRESS = '11111111111111111111111111111111';

export const useTokenBalance = () => {
    const { connection } = useConnection();
    const { publicKey } = useWallet();
    const [balance, setBalance] = useState<number>(0);

    const fetchBalance = useCallback(async () => {
        if (!publicKey) {
            setBalance(0);
            return;
        }

        try {
            // This is for fetching handling standard SPL tokens
            // In a real scenario, we would filter by the specific mint
            const accounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
                programId: TOKEN_PROGRAM_ID,
            });

            const ndriftAccount = accounts.value.find(
                (account: any) => account.account.data.parsed.info.mint === NDRIFT_MINT_ADDRESS
            );

            if (ndriftAccount) {
                setBalance(ndriftAccount.account.data.parsed.info.tokenAmount.uiAmount || 0);
            } else {
                setBalance(0);
            }

        } catch (e) {
            console.warn('Failed to fetch token balance', e);
        }
    }, [connection, publicKey]);

    useEffect(() => {
        fetchBalance();
        const interval = setInterval(fetchBalance, 10000);
        return () => clearInterval(interval);
    }, [fetchBalance]);

    return { balance, fetchBalance };
};
