import { useState, useRef, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useChat } from '../../hooks/useChat';

const FONT = "'Orbitron', monospace, sans-serif";

const EMOJIS = ['😂', '🚀', '🏎️', '🔥', '💀', '🏁', '💸', '👀', '💯'];
const MEMES = [
    { id: 'doge', label: 'Doge', url: 'https://i.imgflip.com/4t0m5.jpg' },
    { id: 'stonks', label: 'Stonks', url: 'https://i.imgflip.com/3pnmgf.jpg' },
    { id: 'fine', label: 'This is Fine', url: 'https://i.imgflip.com/1iruch.jpg' },
    { id: 'pikachu', label: 'Pikachu', url: 'https://i.imgflip.com/2kbn1e.jpg' }
];

export function ChatPanel() {
    const wallet = useWallet();
    const {
        channels, activeChannelId, setActiveChannelId,
        messages, loading, sending, createChannel, sendMessage, refreshChannels
    } = useChat();

    const [input, setInput] = useState('');
    const [newGroupName, setNewGroupName] = useState('');
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [showMemes, setShowMemes] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom of chat
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || sending) return;
        
        await sendMessage(input);
        setInput('');
    };

    const handleCreateGroup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newGroupName.trim()) return;
        
        try {
            await createChannel(newGroupName);
            setNewGroupName('');
            setIsCreatingGroup(false);
            refreshChannels();
        } catch (err) {
            alert('Failed to create group. Check console.');
        }
    };

    if (!wallet.connected) return null;

    const activeChannel = channels.find(c => c.id === activeChannelId);

    return (
        <div style={{
            display: 'flex', flexDirection: 'column',
            height: 450,
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(0,255,255,0.15)',
            borderRadius: 12,
            overflow: 'hidden',
            fontFamily: FONT,
        }}>
            {/* Header: Channel Selection */}
            <div style={{
                background: 'rgba(0,0,0,0.6)',
                borderBottom: '1px solid rgba(0,255,255,0.1)',
                display: 'flex', alignItems: 'center', padding: '10px 16px',
            }}>
                <div style={{ flex: 1, display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
                    {channels.map(ch => (
                        <button
                            key={ch.id}
                            onClick={() => setActiveChannelId(ch.id)}
                            style={{
                                background: activeChannelId === ch.id ? 'rgba(0,255,255,0.1)' : 'transparent',
                                border: '1px solid',
                                borderColor: activeChannelId === ch.id ? 'rgba(0,255,255,0.4)' : 'transparent',
                                color: activeChannelId === ch.id ? '#00ffff' : '#888',
                                padding: '4px 12px', borderRadius: 16,
                                fontSize: 11, fontWeight: 700, letterSpacing: 1,
                                cursor: 'pointer', whiteSpace: 'nowrap',
                                transition: 'all 0.2s',
                            }}
                        >
                            {ch.name === 'Global Lobby' ? '🌍 ' : '💬 '}
                            {ch.name}
                        </button>
                    ))}
                </div>
                
                <button
                    onClick={() => setIsCreatingGroup(!isCreatingGroup)}
                    style={{
                        background: 'rgba(255,0,255,0.1)',
                        border: '1px solid rgba(255,0,255,0.3)',
                        color: '#ff00ff',
                        padding: '4px 12px', borderRadius: 6,
                        marginLeft: 10, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                        whiteSpace: 'nowrap'
                    }}
                >
                    + GROUP
                </button>
            </div>

            {/* Create Group Form */}
            {isCreatingGroup && (
                <form onSubmit={handleCreateGroup} style={{
                    padding: '12px 16px', background: 'rgba(255,0,255,0.05)',
                    borderBottom: '1px solid rgba(255,0,255,0.2)',
                    display: 'flex', gap: 10
                }}>
                    <input
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        placeholder="Enter group name..."
                        maxLength={20}
                        style={{
                            flex: 1, background: 'rgba(0,0,0,0.5)',
                            border: '1px solid rgba(255,0,255,0.4)', borderRadius: 4,
                            color: '#fff', padding: '6px 10px', fontSize: 12, outline: 'none'
                        }}
                        autoFocus
                    />
                    <button type="submit" style={{
                        background: '#ff00ff', color: '#000', border: 'none',
                        padding: '6px 12px', borderRadius: 4, fontSize: 11, fontWeight: 900, cursor: 'pointer'
                    }}>CREATE</button>
                </form>
            )}

            {/* Message History */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {loading ? (
                    <div style={{ textAlign: 'center', color: '#555', fontSize: 11, marginTop: 20 }}>
                        Loading messages...
                    </div>
                ) : messages.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#555', fontSize: 11, marginTop: 20 }}>
                        No messages yet. Say hello!
                    </div>
                ) : (
                    messages.map(msg => {
                        const isMe = msg.sender_wallet === wallet.publicKey?.toBase58();
                        
                        // Parse memes
                        let content = msg.content;
                        let memeImg = null;
                        const memeMatch = content.match(/\[meme:(.+)\]/);
                        if (memeMatch) {
                            const memeId = memeMatch[1];
                            const foundMeme = MEMES.find(m => m.id === memeId);
                            if (foundMeme) {
                                memeImg = foundMeme.url;
                                content = content.replace(memeMatch[0], '').trim();
                            }
                        }

                        return (
                            <div key={msg.id} style={{
                                alignSelf: isMe ? 'flex-end' : 'flex-start',
                                maxWidth: '80%',
                            }}>
                                <div style={{
                                    fontSize: 9, color: '#666', marginBottom: 4,
                                    textAlign: isMe ? 'right' : 'left', letterSpacing: 1
                                }}>
                                    {isMe ? 'YOU' : msg.sender_username}
                                </div>
                                <div style={{
                                    background: isMe ? 'rgba(0,255,255,0.15)' : 'rgba(255,255,255,0.05)',
                                    border: `1px solid ${isMe ? 'rgba(0,255,255,0.3)' : 'rgba(255,255,255,0.1)'}`,
                                    padding: '8px 12px', borderRadius: 8,
                                    color: isMe ? '#e0ffff' : '#ccc',
                                    fontSize: 13, lineHeight: 1.4, wordBreak: 'break-word',
                                    borderBottomRightRadius: isMe ? 0 : 8,
                                    borderBottomLeftRadius: isMe ? 8 : 0,
                                    display: 'flex', flexDirection: 'column', gap: 6
                                }}>
                                    {content && <span>{content}</span>}
                                    {memeImg && (
                                        <img src={memeImg} alt="meme" style={{
                                            maxWidth: '100%', borderRadius: 6,
                                            border: '1px solid rgba(255,255,255,0.2)'
                                        }} />
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Toolbar: Emojis & Memes */}
            <div style={{
                padding: '8px 16px', background: 'rgba(0,0,0,0.5)',
                borderTop: '1px solid rgba(0,255,255,0.1)',
                display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
                position: 'relative'
            }}>
                <div style={{ display: 'flex', gap: 6 }}>
                    {EMOJIS.map(emoji => (
                        <button
                            key={emoji}
                            onClick={() => setInput(prev => prev + emoji)}
                            style={{
                                background: 'transparent', border: 'none',
                                fontSize: 16, cursor: 'pointer', padding: 2,
                                transition: 'transform 0.1s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'}
                            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
                
                <div style={{ flex: 1 }} />
                
                <button
                    onClick={() => setShowMemes(!showMemes)}
                    style={{
                        background: showMemes ? 'rgba(255,255,0,0.2)' : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${showMemes ? 'rgba(255,255,0,0.5)' : 'rgba(255,255,255,0.1)'}`,
                        color: showMemes ? '#ffff00' : '#aaa',
                        padding: '4px 10px', borderRadius: 6,
                        fontSize: 11, fontWeight: 700, cursor: 'pointer',
                        transition: 'all 0.2s', fontFamily: FONT, letterSpacing: 1
                    }}
                >
                    MEMES 🖼️
                </button>

                {/* Meme Popup */}
                {showMemes && (
                    <div style={{
                        position: 'absolute', bottom: '100%', right: 16, marginBottom: 8,
                        background: 'rgba(10,10,20,0.95)', border: '1px solid rgba(255,255,0,0.3)',
                        borderRadius: 8, padding: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
                        boxShadow: '0 -4px 20px rgba(0,0,0,0.5)'
                    }}>
                        {MEMES.map(meme => (
                            <button
                                key={meme.id}
                                onClick={() => {
                                    sendMessage(`[meme:${meme.id}]`);
                                    setShowMemes(false);
                                }}
                                style={{
                                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: 4, padding: 4, cursor: 'pointer',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,0,0.1)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                            >
                                <img src={meme.url} alt={meme.label} style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 2 }} />
                                <span style={{ fontSize: 9, color: '#fff', fontFamily: FONT }}>{meme.label}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Input Area */}
            <form onSubmit={handleSend} style={{
                padding: '12px 16px', background: 'rgba(0,0,0,0.7)',
                borderTop: '1px solid rgba(0,255,255,0.1)',
                display: 'flex', gap: 10
            }}>
                <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={`Message ${activeChannel?.name || 'lobby'}...`}
                    maxLength={150}
                    disabled={sending || !activeChannelId}
                    style={{
                        flex: 1, background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
                        color: '#fff', padding: '10px 14px', fontSize: 13, outline: 'none',
                    }}
                    onFocus={e => e.currentTarget.style.borderColor = 'rgba(0,255,255,0.4)'}
                    onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
                <button
                    type="submit"
                    disabled={sending || !input.trim() || !activeChannelId}
                    style={{
                        background: input.trim() ? '#00ffff' : 'rgba(255,255,255,0.1)',
                        color: input.trim() ? '#000' : '#888',
                        border: 'none', padding: '0 20px', borderRadius: 6,
                        fontFamily: FONT, fontSize: 13, fontWeight: 900, letterSpacing: 1,
                        cursor: input.trim() ? 'pointer' : 'not-allowed',
                        transition: 'all 0.2s'
                    }}
                >
                    SEND
                </button>
            </form>
        </div>
    );
}
