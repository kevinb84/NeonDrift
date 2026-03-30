import { useState, useEffect, useCallback } from 'react';
import { insforge } from '../lib/insforge';
import { useWallet } from '@solana/wallet-adapter-react';

export interface MatchRecord {
    id: string;
    creator_wallet: string;
    creator_username: string | null;
    opponent_wallet: string | null;
    opponent_username: string | null;
    entry_fee: number;
    status: 'waiting' | 'locked' | 'racing' | 'completed' | 'cancelled';
    track_id: string | null;
    difficulty: string;
    winner_wallet: string | null;
    created_at: string;
    updated_at: string;
}

export type LobbyEvent =
    | { type: 'player_joined'; match: MatchRecord }
    | { type: 'match_locked'; match: MatchRecord }
    | { type: 'match_racing'; match: MatchRecord }
    | { type: 'match_completed'; match: MatchRecord }
    | { type: 'match_cancelled'; match: MatchRecord }
    | { type: 'new_match'; match: MatchRecord };

export function useMatchmaking() {
    const wallet = useWallet();
    const [matches, setMatches] = useState<MatchRecord[]>([]);
    const [myMatch, setMyMatch] = useState<MatchRecord | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [events, setEvents] = useState<LobbyEvent[]>([]);


    // ─── Fetch all active (waiting) matches ───
    const fetchMatches = useCallback(async () => {
        try {
            const { data, error: fetchErr } = await insforge.database
                .from('matches')
                .select('*')
                .in('status', ['waiting', 'locked', 'racing'])
                .order('created_at', { ascending: false })
                .limit(50);

            if (fetchErr) {
                console.error('Error fetching matches:', fetchErr);
                return;
            }
            setMatches(data || []);
        } catch (e) {
            console.error('Failed to fetch matches:', e);
        }
    }, []);

    // ─── Find the current user's active match ───
    const findMyMatch = useCallback(async () => {
        if (!wallet.publicKey) return null;
        const walletAddr = wallet.publicKey.toBase58();

        try {
            // Check if user is creator of an active match
            const { data: created } = await insforge.database
                .from('matches')
                .select('*')
                .eq('creator_wallet', walletAddr)
                .in('status', ['waiting', 'locked', 'racing'])
                .limit(1);

            if (created && created.length > 0) {
                setMyMatch(created[0]);
                return created[0];
            }

            // Check if user is opponent of an active match
            const { data: joined } = await insforge.database
                .from('matches')
                .select('*')
                .eq('opponent_wallet', walletAddr)
                .in('status', ['waiting', 'locked', 'racing'])
                .limit(1);

            if (joined && joined.length > 0) {
                setMyMatch(joined[0]);
                return joined[0];
            }

            setMyMatch(null);
            return null;
        } catch (e) {
            console.error('Failed to find my match:', e);
            return null;
        }
    }, [wallet.publicKey]);

    // ─── Create a new match in the DB ───
    const createMatchEntry = useCallback(async (matchId: string, entryFee: number = 0.1) => {
        if (!wallet.publicKey) throw new Error('Wallet not connected');
        setLoading(true);
        setError(null);

        try {
            const walletAddr = wallet.publicKey.toBase58();

            const { data, error: insertErr } = await insforge.database
                .from('matches')
                .insert([{
                    id: matchId,
                    creator_wallet: walletAddr,
                    creator_username: walletAddr.slice(0, 4) + '...' + walletAddr.slice(-4),
                    entry_fee: entryFee,
                    status: 'waiting',
                }])
                .select()
                .single();

            if (insertErr) throw new Error(insertErr.message);
            setMyMatch(data);
            return data as MatchRecord;
        } catch (e: any) {
            setError(e.message);
            throw e;
        } finally {
            setLoading(false);
        }
    }, [wallet.publicKey]);

    // ─── Join an existing match ───
    const joinMatchEntry = useCallback(async (matchId: string) => {
        if (!wallet.publicKey) throw new Error('Wallet not connected');
        setLoading(true);
        setError(null);

        try {
            const walletAddr = wallet.publicKey.toBase58();

            const { data, error: updateErr } = await insforge.database
                .from('matches')
                .update({
                    opponent_wallet: walletAddr,
                    opponent_username: walletAddr.slice(0, 4) + '...' + walletAddr.slice(-4),
                    status: 'locked',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', matchId)
                .eq('status', 'waiting')
                .select()
                .single();

            if (updateErr) throw new Error(updateErr.message);
            setMyMatch(data);
            return data as MatchRecord;
        } catch (e: any) {
            setError(e.message);
            throw e;
        } finally {
            setLoading(false);
        }
    }, [wallet.publicKey]);

    // ─── Update match status ───
    const updateMatchStatus = useCallback(async (matchId: string, status: MatchRecord['status'], extra?: Record<string, any>) => {
        try {
            const { data, error: updateErr } = await insforge.database
                .from('matches')
                .update({
                    status,
                    updated_at: new Date().toISOString(),
                    ...extra,
                })
                .eq('id', matchId)
                .select()
                .single();

            if (updateErr) throw new Error(updateErr.message);
            if (data) setMyMatch(data);
            return data as MatchRecord;
        } catch (e: any) {
            console.error('Failed to update match status:', e);
            throw e;
        }
    }, []);

    // ─── Cancel match ───
    const cancelMatch = useCallback(async (matchId: string) => {
        await updateMatchStatus(matchId, 'cancelled');
        setMyMatch(null);
    }, [updateMatchStatus]);

    // ─── Real-time subscription ───
    useEffect(() => {
        const channelName = 'lobby:matches';

        const setup = async () => {
            try {
                await insforge.realtime.subscribe(channelName);
                console.log('[Lobby] Subscribed to match updates');
            } catch (err) {
                console.error('[Lobby] Failed to subscribe:', err);
            }
        };

        // Listen for match change events published by other clients
        const handleMatchEvent = (message: any) => {
            const data = message?.payload || message;
            if (!data?.match) return;

            const newRecord = data.match as MatchRecord;
            const eventType = data.eventType as string;

            // Update local match list
            setMatches(prev => {
                if (eventType === 'INSERT') {
                    // Avoid duplicates
                    if (prev.some(m => m.id === newRecord.id)) return prev;
                    return [newRecord, ...prev];
                }
                if (eventType === 'UPDATE') {
                    if (['completed', 'cancelled'].includes(newRecord.status)) {
                        return prev.filter(m => m.id !== newRecord.id);
                    }
                    return prev.map(m => m.id === newRecord.id ? newRecord : m);
                }
                if (eventType === 'DELETE') {
                    return prev.filter(m => m.id !== newRecord.id);
                }
                return prev;
            });

            // Update myMatch if it's the user's match
            if (wallet.publicKey) {
                const walletAddr = wallet.publicKey.toBase58();
                if (
                    newRecord.creator_wallet === walletAddr ||
                    newRecord.opponent_wallet === walletAddr
                ) {
                    if (['completed', 'cancelled'].includes(newRecord.status)) {
                        setMyMatch(null);
                    } else {
                        setMyMatch(newRecord);
                    }
                }
            }

            // Push lobby events for toasts/notifications
            let lobbyEvent: LobbyEvent | null = null;
            if (eventType === 'INSERT') {
                lobbyEvent = { type: 'new_match', match: newRecord };
            } else if (eventType === 'UPDATE') {
                if (newRecord.status === 'locked' && newRecord.opponent_wallet) {
                    lobbyEvent = { type: 'player_joined', match: newRecord };
                } else if (newRecord.status === 'racing') {
                    lobbyEvent = { type: 'match_racing', match: newRecord };
                } else if (newRecord.status === 'completed') {
                    lobbyEvent = { type: 'match_completed', match: newRecord };
                } else if (newRecord.status === 'cancelled') {
                    lobbyEvent = { type: 'match_cancelled', match: newRecord };
                }
            }

            if (lobbyEvent) {
                setEvents(prev => [...prev.slice(-9), lobbyEvent!]);
            }
        };

        insforge.realtime.on('match_change', handleMatchEvent);
        setup();

        // Also poll every 5 seconds as a fallback
        const pollInterval = setInterval(() => {
            fetchMatches();
        }, 5000);

        // Initial fetch
        fetchMatches();

        return () => {
            insforge.realtime.off('match_change', handleMatchEvent);
            insforge.realtime.unsubscribe(channelName);
            clearInterval(pollInterval);
        };
    }, [wallet.publicKey]); // Re-subscribe when wallet changes

    // Clear events after a timeout
    const clearEvent = useCallback((index: number) => {
        setEvents(prev => prev.filter((_, i) => i !== index));
    }, []);

    return {
        matches,
        myMatch,
        loading,
        error,
        events,
        clearEvent,
        createMatchEntry,
        joinMatchEntry,
        updateMatchStatus,
        cancelMatch,
        fetchMatches,
        findMyMatch,
    };
}
