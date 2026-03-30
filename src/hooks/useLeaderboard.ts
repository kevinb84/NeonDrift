import { useEffect, useState } from 'react';
import { insforge } from '../lib/insforge';
import { Profile } from './useProfile';

export const useLeaderboard = () => {
    const [leaderboard, setLeaderboard] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchLeaderboard = async () => {
        setLoading(true);
        try {
            // Explicitly cast or assume types if SDK is weird
            const { data, error } = await insforge.database
                .from('profiles')
                .select('*')
                .order('high_score', { ascending: false })
                .limit(10);

            if (data) {
                setLeaderboard(data as Profile[]);
            } else if (error) {
                console.error('Error fetching leaderboard:', error);
            }
        } catch (e) {
            console.error('Failed to fetch leaderboard', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLeaderboard();
        // Refresh every 30s
        const interval = setInterval(fetchLeaderboard, 30000);
        return () => clearInterval(interval);
    }, []);

    return { leaderboard, loading, refresh: fetchLeaderboard };
};
