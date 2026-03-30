import { useState, useCallback, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { insforge } from '../lib/insforge';
import bs58 from 'bs58';

export function useWalletAuth() {
    const { publicKey, signMessage } = useWallet();
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);

    // Initial session check
    useEffect(() => {
        insforge.auth.getCurrentSession().then(({ data }) => {
            setIsAuthenticated(!!data?.session);
        }).catch(() => {
            setIsAuthenticated(false);
        });
    }, []);

    const authenticateWithWallet = useCallback(async () => {
        if (!publicKey || !signMessage) {
            throw new Error('Wallet not connected or does not support message signing');
        }

        try {
            setIsAuthenticating(true);

            // 1. User signs a deterministic message to prove ownership
            const message = "Sign in to Neon Project with Wallet: " + publicKey.toBase58();
            const messageBytes = new TextEncoder().encode(message);
            const signatureBytes = await signMessage(messageBytes);
            const signature = bs58.encode(signatureBytes);

            // 2. Send signature to our secure Local NodeJS oracle server
            // (TEMPORARY: We proxy this locally because npx insforge functions deploy crashes on Windows Node 24)
            const response = await fetch('http://localhost:3001/wallet-auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    publicKey: publicKey.toBase58(),
                    signature,
                    message,
                })
            });

            const data = await response.json();

            if (!response.ok || !data?.success) {
                throw new Error(data?.error || 'Authentication bridge failed');
            }

            // 3. The edge function verified the signature and returned deterministic credentials
            // We now securely log into the actual InsForge Auth session!
            let { error: signInError } = await insforge.auth.signInWithPassword({
                email: data.email,
                password: data.password,
            });

            if (signInError) {
                // If it fails, the user likely doesn't exist yet, we create them from the client!
                // We strongly trust this because the Oracle securely provided the deterministic password.
                const { error: signUpError } = await insforge.auth.signUp({
                    email: data.email,
                    password: data.password
                });

                if (signUpError && !signUpError.message.includes('already registered')) {
                    throw signUpError;
                }
                
                // Try signing in again if signUp succeeded but didn't auto-login
                const { error: signInErrRetry } = await insforge.auth.signInWithPassword({
                    email: data.email,
                    password: data.password,
                });
                
                if (signInErrRetry) throw signInErrRetry;
            }

            setIsAuthenticated(true);
            return true;

        } catch (err: any) {
            console.error('Wallet auth error:', err);
            throw err;
        } finally {
            setIsAuthenticating(false);
        }
    }, [publicKey, signMessage]);

    return {
        isAuthenticated,
        isAuthenticating,
        authenticateWithWallet
    };
}
