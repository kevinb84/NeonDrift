import { useRef, useCallback, useEffect, useState } from 'react';
import { insforge } from '../../lib/insforge';

// ─── Types ───
export interface PlayerState {
    x: number;         // lateral position (logic X, without curve offset)
    speed: number;     // current speed
    totalDist: number; // cumulative distance driven  
    lap: number;       // current lap
    nitro: boolean;    // nitro active?
    finished: boolean; // crossed final finish line?
    raceTime: number;  // ms since race start
    timestamp: number; // Date.now() for interpolation
}

export interface RemotePlayerData extends PlayerState {
    wallet: string;
    username: string;
}

// Broadcast at ~30Hz (every ~33ms) for ultra-smooth competitive racing
const BROADCAST_INTERVAL = 33;

/**
 * Real-time multiplayer sync hook.
 * Uses InsForge Realtime `publish`/`on` for low-latency player position updates.
 */
export function useMultiplayerSync(matchId: string | null, walletAddr: string | null, username: string | null) {
    const lastBroadcastRef = useRef(0);
    const [remotePlayer, setRemotePlayer] = useState<RemotePlayerData | null>(null);
    const [remoteFinished, setRemoteFinished] = useState(false);
    const [isConnected, setIsConnected] = useState(false);

    // Store the latest remote state in a ref for per-frame interpolation access
    const remoteStateRef = useRef<RemotePlayerData | null>(null);
    // Buffer for interpolation — keep the last 2 states
    const remoteBufferRef = useRef<RemotePlayerData[]>([]);
    // Track whether we've subscribed
    const subscribedRef = useRef(false);
    const channelNameRef = useRef<string | null>(null);

    useEffect(() => {
        if (!matchId || !walletAddr) return;

        const channelName = `game:${matchId}`;
        channelNameRef.current = channelName;

        const handlePlayerState = (payload: any) => {
            try {
                const data = payload;
                if (data && data.wallet && data.wallet !== walletAddr) {
                    const remoteData = { ...data, localReceiveTime: performance.now() } as RemotePlayerData & { localReceiveTime: number };
                    remoteStateRef.current = remoteData;
                    setRemotePlayer(remoteData);

                    // Keep buffer for interpolation
                    remoteBufferRef.current = [
                        ...remoteBufferRef.current.slice(-1),
                        remoteData,
                    ];

                    if (remoteData.finished) {
                        setRemoteFinished(true);
                    }
                }
            } catch (e) {
                console.error('[MP] Parse error', e);
            }
        };

        const handleCountdown = (_payload: any) => {
            // Optional: handling remote countdown if you need both players synced perfectly
        };

        insforge.realtime.connect().then(() => {
            insforge.realtime.subscribe(channelName).then(response => {
                if (response.ok) {
                    subscribedRef.current = true;
                    setIsConnected(true);
                    console.log(`[MP] Connected to InsForge WS match channel: ${matchId}`);
                } else {
                    console.error('[MP] Failed to subscribe:', response.error?.message);
                }
            });
        });

        insforge.realtime.on('player_state', handlePlayerState);
        insforge.realtime.on('race_countdown', handleCountdown);

        return () => {
            insforge.realtime.off('player_state', handlePlayerState);
            insforge.realtime.off('race_countdown', handleCountdown);
            if (channelNameRef.current) {
                insforge.realtime.unsubscribe(channelNameRef.current);
                channelNameRef.current = null;
            }
            subscribedRef.current = false;
            setIsConnected(false);
        };
    }, [matchId, walletAddr]);

    // ─── Broadcast local player state ───
    const broadcastState = useCallback((state: PlayerState) => {
        if (!channelNameRef.current || !walletAddr || !subscribedRef.current) return;

        const now = Date.now();
        // Throttle to BROADCAST_INTERVAL
        if (now - lastBroadcastRef.current < BROADCAST_INTERVAL) return;
        lastBroadcastRef.current = now;

        insforge.realtime.publish(channelNameRef.current, 'player_state', {
            ...state,
            wallet: walletAddr,
            username: username || walletAddr.slice(0, 4) + '...' + walletAddr.slice(-4),
            timestamp: now,
        });
    }, [walletAddr, username]);

    // ─── Interpolate/Extrapolate remote player position for smooth rendering ───
    const getInterpolatedState = useCallback((): RemotePlayerData | null => {
        const buf = remoteBufferRef.current as (RemotePlayerData & { localReceiveTime: number })[];
        if (buf.length === 0) return null;
        if (buf.length === 1) return buf[0];

        const prev = buf[0];
        const curr = buf[1];
        
        const now = performance.now();
        const elapsed = now - curr.localReceiveTime;
        const interval = curr.localReceiveTime - prev.localReceiveTime;

        if (interval <= 0) return curr;

        // Velocity over the interval
        const vx = (curr.x - prev.x) / interval;
        const vSpeed = (curr.speed - prev.speed) / interval;
        const vDist = (curr.totalDist - prev.totalDist) / interval;

        // Extrapolate factor bounded to prevent crazy fly-offs if connection drops
        const tExtrapolate = Math.min(elapsed, BROADCAST_INTERVAL * 2);

        return {
            ...curr,
            x: curr.x + vx * tExtrapolate,
            speed: curr.speed + vSpeed * tExtrapolate,
            totalDist: curr.totalDist + vDist * tExtrapolate,
            timestamp: Date.now(),
        };
    }, []);

    // ─── Broadcast countdown sync ───
    const broadcastCountdown = useCallback((countdown: number) => {
        if (!channelNameRef.current || !subscribedRef.current) return;
        insforge.realtime.publish(channelNameRef.current, 'race_countdown', { 
            countdown, 
            wallet: walletAddr 
        });
    }, [walletAddr]);

    return {
        broadcastState,
        broadcastCountdown,
        getInterpolatedState,
        remotePlayer,
        remoteStateRef,
        remoteFinished,
        isConnected,
    };
}
