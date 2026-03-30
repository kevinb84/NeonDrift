import { useWallet } from '@solana/wallet-adapter-react';
import { useEffect, useState } from 'react';
import { insforge } from '../lib/insforge';

export interface Profile {
    id?: string;
    wallet_address: string;
    username: string | null;
    avatar_url?: string | null;
    is_admin?: boolean;
    high_score: number;
    games_played: number;
}

export const useProfile = () => {
    const { publicKey } = useWallet();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(false);

    const fetchProfile = async () => {
        if (!publicKey) return;
        setLoading(true);
        const address = publicKey.toBase58();

        try {
            // Try to get profile
            const { data, error: _error } = await (insforge as any).database
                .from('profiles')
                .select('*')
                .eq('wallet_address', address)
                .single();

            if (data) {
                setProfile(data as Profile);
            } else {
                // Create if not exists (Auto-registration)
                const newProfile: Profile = {
                    wallet_address: address,
                    username: `Racer-${address.slice(0, 4)}`,
                    high_score: 0,
                    games_played: 0
                };

                const { data: created, error: _createError } = await (insforge as any).database
                    .from('profiles')
                    .insert([newProfile])
                    .select()
                    .single();

                if (created) setProfile(created as Profile);
            }
        } catch (err) {
            console.error('Error fetching profile:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!publicKey) {
            setProfile(null);
            return;
        }
        fetchProfile();
    }, [publicKey]);

    return { profile, loading, refetch: fetchProfile };
};
