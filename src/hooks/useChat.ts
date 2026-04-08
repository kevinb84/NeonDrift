import { useState, useCallback, useEffect, useRef } from 'react';
import { insforge } from '../lib/insforge';
import { useWallet } from '@solana/wallet-adapter-react';

export interface ChatChannel {
    id: string;
    name: string;
    created_by_wallet: string | null;
    created_at: string;
}

export interface ChatMessage {
    id: string;
    channel_id: string;
    sender_wallet: string;
    sender_username: string | null;
    content: string;
    created_at: string;
}

export function useChat() {
    const wallet = useWallet();
    const [channels, setChannels] = useState<ChatChannel[]>([]);
    const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);

    const subscribedChannelRef = useRef<string | null>(null);

    // ─── Fetch Channels ───
    const fetchChannels = useCallback(async () => {
        try {
            const { data, error } = await insforge.database
                .from('chat_channels')
                .select('*')
                .order('created_at', { ascending: true });

            if (error) throw error;

            if (data) {
                setChannels(data as ChatChannel[]);
                // Auto-select Global Lobby if no active channel
                if (!activeChannelId && data.length > 0) {
                    const global = data.find((c: ChatChannel) => c.name === 'Global Lobby') || data[0];
                    setActiveChannelId(global.id);
                }
            }
        } catch (err) {
            console.error('Failed to fetch chat channels:', err);
        }
    }, [activeChannelId]);

    // ─── Create Channel ───
    const createChannel = useCallback(async (name: string) => {
        if (!wallet.publicKey) throw new Error('Wallet not connected');
        try {
            const { data, error } = await insforge.database
                .from('chat_channels')
                .insert([{
                    name,
                    created_by_wallet: wallet.publicKey.toBase58()
                }])
                .select()
                .single();

            if (error) throw error;
            if (data) {
                setChannels(prev => [...prev, data as ChatChannel]);
                setActiveChannelId(data.id);
            }
        } catch (err) {
            console.error('Failed to create channel:', err);
            throw err;
        }
    }, [wallet.publicKey]);

    // ─── Fetch Messages ───
    const fetchMessages = useCallback(async (channelId: string) => {
        setLoading(true);
        try {
            const { data, error } = await insforge.database
                .from('chat_messages')
                .select('*')
                .eq('channel_id', channelId)
                .order('created_at', { ascending: true })
                .limit(100);

            if (error) throw error;
            if (data) setMessages(data as ChatMessage[]);
        } catch (err) {
            console.error('Failed to fetch messages:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    // ─── Realtime Subscription ───
    useEffect(() => {
        if (!activeChannelId) return;

        // Fetch history when switching channels
        fetchMessages(activeChannelId);

        // Name of the realtime room
        const roomName = `chat:${activeChannelId}`;
        subscribedChannelRef.current = roomName;

        const handleNewMessage = (payload: any) => {
            const message = payload?.message || payload;
            if (message && message.channel_id === activeChannelId) {
                setMessages(prev => {
                    // Avoid duplicates
                    if (prev.some(m => m.id === message.id)) return prev;
                    return [...prev, message as ChatMessage];
                });
            }
        };

        const setupRealtime = async () => {
            try {
                // Ensure connection is up
                await insforge.realtime.connect();
                const res = await insforge.realtime.subscribe(roomName);
                if (!res.ok) {
                    console.error('Failed to subscribe to chat channel:', res.error);
                }
            } catch (err) {
                console.error('Error connecting to chat realtime:', err);
            }
        };

        setupRealtime();
        insforge.realtime.on('chat_message', handleNewMessage);

        // Also poll for channels every 10s so new groups show up
        const pollInterval = setInterval(() => {
            fetchChannels();
        }, 10000);

        return () => {
            clearInterval(pollInterval);
            insforge.realtime.off('chat_message', handleNewMessage);
            if (subscribedChannelRef.current) {
                insforge.realtime.unsubscribe(subscribedChannelRef.current);
            }
        };
    }, [activeChannelId, fetchMessages, fetchChannels]);

    // Initial channel fetch
    useEffect(() => {
        fetchChannels();
    }, [fetchChannels]);

    // ─── Send Message ───
    const sendMessage = useCallback(async (content: string, username?: string) => {
        if (!wallet.publicKey || !activeChannelId || !content.trim()) return;
        setSending(true);

        const walletAddr = wallet.publicKey.toBase58();
        const displayUsername = username || walletAddr.slice(0, 4) + '...' + walletAddr.slice(-4);
        const tempId = crypto.randomUUID();

        const newMsg: ChatMessage = {
            id: tempId,
            channel_id: activeChannelId,
            sender_wallet: walletAddr,
            sender_username: displayUsername,
            content: content.trim(),
            created_at: new Date().toISOString()
        };

        // Optimistic UI update
        setMessages(prev => [...prev, newMsg]);

        try {
            // 1. Publish for immediate display to others
            if (subscribedChannelRef.current) {
                insforge.realtime.publish(subscribedChannelRef.current, 'chat_message', newMsg);
            }

            // 2. Persist to DB
            const { data, error } = await insforge.database
                .from('chat_messages')
                .insert([newMsg])
                .select()
                .single();

            if (error) {
                console.warn('Realtime chat sent, but DB insert failed:', error);
            } else if (data) {
                // Replace optimistic ID with real one if needed
                setMessages(prev => prev.map(m => m.id === tempId ? data : m));
            }
        } catch (err) {
            console.error('Failed to send message:', err);
        } finally {
            setSending(false);
        }
    }, [wallet.publicKey, activeChannelId]);

    return {
        channels,
        activeChannelId,
        setActiveChannelId,
        messages,
        loading,
        sending,
        createChannel,
        sendMessage,
        refreshChannels: fetchChannels
    };
}
