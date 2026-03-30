import { useState, useRef } from 'react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Rocket, CheckCircle, Image as ImageIcon, X, Globe, ExternalLink, AlertTriangle } from 'lucide-react';
import { useBlueprint } from '../hooks/useBlueprint';
import { useWallet } from '@solana/wallet-adapter-react';
import { useProfile } from '../hooks/useProfile';
import { cn } from '../lib/utils';
import { insforge } from '../lib/insforge';

import { LAMPORTS_PER_SOL } from '@solana/web3.js';

const STEPS = [
    { id: 1, name: 'Token Details', icon: Rocket },
    { id: 2, name: 'Media & Socials', icon: Globe },
    { id: 3, name: 'Review & Launch', icon: CheckCircle },
];

export const CreateToken = () => {
    const { createToken, isLoading, error, isMainnet } = useBlueprint();
    const { connected } = useWallet();
    const { profile, loading } = useProfile();
    const [step, setStep] = useState(1);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        symbol: '',
        description: '',
        imageUrl: '',
        twitter: '',
        website: '',
        telegram: '',
        initialBuySOL: '0.01', // Initial buy amount in SOL
    });
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string>('');
    const [isUploading, setIsUploading] = useState(false);
    const [launchResult, setLaunchResult] = useState<{ mint?: string; tx?: string } | null>(null);

    const handleNext = () => setStep(prev => Math.min(prev + 1, 3));
    const handleBack = () => setStep(prev => Math.max(prev - 1, 1));

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
            setFormData(prev => ({ ...prev, imageUrl: '' }));
        }
    };

    const clearFile = () => {
        setImageFile(null);
        setPreviewUrl('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const uploadImage = async (file: File): Promise<string> => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error } = await insforge.storage
            .from('token-images')
            .upload(fileName, file);

        if (error) {
            throw new Error('Image upload failed: ' + error.message);
        }

        const response: any = insforge.storage
            .from('token-images')
            .getPublicUrl(fileName);

        const publicUrl = response.data?.publicUrl || response;
        return publicUrl;
    };

    const handleSubmit = async () => {
        try {
            if (!connected) return;

            let finalImageUrl = formData.imageUrl;

            if (imageFile) {
                setIsUploading(true);
                try {
                    finalImageUrl = await uploadImage(imageFile);
                } catch (uploadError: any) {
                    console.error('Upload failed', uploadError);
                    alert('Failed to upload image. Please try again or use a URL.');
                    setIsUploading(false);
                    return;
                }
                setIsUploading(false);
            }

            if (!finalImageUrl) {
                alert('Please provide an image URL or upload an image.');
                return;
            }

            const initialBuyLamports = Math.floor(parseFloat(formData.initialBuySOL || '0') * LAMPORTS_PER_SOL);

            const result = await createToken(
                formData.name,
                formData.symbol,
                finalImageUrl,
                formData.description,
                {
                    twitter: formData.twitter || undefined,
                    website: formData.website || undefined,
                    telegram: formData.telegram || undefined,
                },
                initialBuyLamports,
            );

            setLaunchResult({ mint: result.mint, tx: result.transaction });
        } catch (e) {
            console.error('Launch failed', e);
            setIsUploading(false);
        }
    };

    if (loading) {
        return <div className="text-center py-32 text-slate-500">Loading...</div>;
    }

    if (!profile?.is_admin) {
        return (
            <div className="flex flex-col items-center justify-center py-32 text-slate-400">
                <X size={64} className="text-red-500/50 mb-4" />
                <h1 className="text-2xl font-bold text-red-500 mb-2">Access Denied</h1>
                <p className="text-sm">You do not have permission to view the Admin panel.</p>
            </div>
        );
    }

    // ── Success Screen ───────────────────────────────────────────
    if (launchResult) {
        return (
            <div className="max-w-2xl mx-auto space-y-8">
                <div className="text-center space-y-4 py-16">
                    <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4 border-2 border-green-500/40">
                        <CheckCircle className="w-10 h-10 text-green-400" />
                    </div>
                    <h1 className="text-3xl font-bold text-green-400">Token Launched! 🎉</h1>
                    <p className="text-slate-400">Your token has been {isMainnet ? 'deployed' : 'simulated'} successfully.</p>

                    <Card glass className="text-left mt-8">
                        <CardContent className="p-6 space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-400">Token Name</span>
                                <span className="font-bold">{formData.name} ({formData.symbol})</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-400">Mint Address</span>
                                <span className="font-mono text-xs text-cyan-400">{launchResult.mint}</span>
                            </div>
                            {launchResult.tx && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400">Transaction</span>
                                    <span className="font-mono text-xs text-slate-300">{launchResult.tx.slice(0, 20)}...</span>
                                </div>
                            )}
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-400">Network</span>
                                <span className={isMainnet ? 'text-green-400' : 'text-yellow-400'}>
                                    {isMainnet ? 'Solana Mainnet' : 'Devnet (Mock)'}
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    {isMainnet && launchResult.mint && (
                        <a
                            href={`https://bags.fm/${launchResult.mint}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 text-sm mt-4"
                        >
                            <ExternalLink className="w-4 h-4" /> View on Bags.fm
                        </a>
                    )}

                    <Button onClick={() => { setLaunchResult(null); setStep(1); }} className="mt-6">
                        Create Another Token
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-8">
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-red-400 to-orange-400">
                    Administrator Controls
                </h1>
                <p className="text-slate-400">
                    {isMainnet
                        ? 'Launch token on Solana mainnet via Bags.fm'
                        : 'Token launch preview (devnet mock — switch to mainnet for real deploy)'
                    }
                </p>
                {!isMainnet && (
                    <div className="inline-flex items-center gap-1.5 text-xs text-yellow-400 bg-yellow-500/10 px-3 py-1.5 rounded-full border border-yellow-500/20">
                        <AlertTriangle className="w-3 h-3" />
                        DEVNET MODE — Real launch requires mainnet + Bags API key
                    </div>
                )}
            </div>

            {/* Stepper */}
            <div className="flex justify-between relative">
                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-800 -z-10" />
                {STEPS.map((s) => {
                    const isActive = s.id === step;
                    const isCompleted = s.id < step;
                    return (
                        <div key={s.id} className="flex flex-col items-center bg-background px-2">
                            <div className={cn(
                                'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300',
                                isActive ? 'border-primary bg-primary/10 text-primary scale-110' :
                                    isCompleted ? 'border-green-500 bg-green-500/10 text-green-500' : 'border-slate-700 bg-slate-900 text-slate-500'
                            )}>
                                <s.icon size={18} />
                            </div>
                            <span className={cn('text-xs mt-2 font-medium', isActive ? 'text-primary' : 'text-slate-500')}>
                                {s.name}
                            </span>
                        </div>
                    );
                })}
            </div>

            <Card glass>
                <CardContent className="pt-6">
                    {/* ── Step 1: Token Details ─────────────────────────── */}
                    {step === 1 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="Token Name"
                                    placeholder="Neon Drift"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                                <Input
                                    label="Symbol"
                                    placeholder="NDRIFT"
                                    value={formData.symbol}
                                    onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                                />
                            </div>
                            <Input
                                label="Description"
                                placeholder="What is your token about?"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            />
                            <Input
                                label="Initial Buy (SOL)"
                                placeholder="0.01"
                                value={formData.initialBuySOL}
                                onChange={(e) => setFormData({ ...formData, initialBuySOL: e.target.value })}
                                type="number"
                            />
                            <p className="text-[11px] text-slate-500 pl-1">
                                This is the initial SOL amount you'll purchase with at launch via Bags bonding curve.
                            </p>
                        </div>
                    )}

                    {/* ── Step 2: Media & Socials ──────────────────────── */}
                    {step === 2 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            {/* Image Upload */}
                            <div className="space-y-4">
                                <label className="block text-sm font-medium text-slate-300">Token Image</label>

                                {!previewUrl ? (
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className="border-2 border-dashed border-slate-700 rounded-lg p-8 text-center hover:border-primary hover:bg-slate-800/50 transition-colors cursor-pointer group"
                                    >
                                        <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                                            <ImageIcon className="w-6 h-6 text-slate-400 group-hover:text-primary" />
                                        </div>
                                        <p className="text-sm text-slate-300 font-medium">Click to upload image</p>
                                        <p className="text-xs text-slate-500 mt-1">SVG, PNG, JPG or GIF (max. 5MB)</p>
                                    </div>
                                ) : (
                                    <div className="relative w-full aspect-video max-w-sm mx-auto bg-slate-900 rounded-lg overflow-hidden border border-slate-700 group">
                                        <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button variant="danger" size="sm" onClick={(e) => { e.stopPropagation(); clearFile(); }}>
                                                <X className="w-4 h-4 mr-2" />
                                                Remove Image
                                            </Button>
                                        </div>
                                    </div>
                                )}
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                />

                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center">
                                        <span className="w-full border-t border-slate-800" />
                                    </div>
                                    <div className="relative flex justify-center text-xs uppercase">
                                        <span className="bg-background px-2 text-slate-500">Or use URL</span>
                                    </div>
                                </div>

                                <Input
                                    label="Image URL (Optional if uploading)"
                                    placeholder="https://..."
                                    value={formData.imageUrl}
                                    onChange={(e) => {
                                        setFormData({ ...formData, imageUrl: e.target.value });
                                        if (e.target.value) clearFile();
                                    }}
                                    disabled={!!imageFile}
                                />
                            </div>

                            {/* Social Links */}
                            <div className="space-y-3">
                                <label className="block text-sm font-medium text-slate-300">Social Links (Optional)</label>
                                <Input
                                    label="Twitter / X"
                                    placeholder="https://x.com/NeonDrift"
                                    value={formData.twitter}
                                    onChange={(e) => setFormData({ ...formData, twitter: e.target.value })}
                                />
                                <Input
                                    label="Website"
                                    placeholder="https://neondrift.gg"
                                    value={formData.website}
                                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                                />
                                <Input
                                    label="Telegram"
                                    placeholder="https://t.me/neondrift"
                                    value={formData.telegram}
                                    onChange={(e) => setFormData({ ...formData, telegram: e.target.value })}
                                />
                            </div>
                        </div>
                    )}

                    {/* ── Step 3: Review & Launch ──────────────────────── */}
                    {step === 3 && (
                        <div className="space-y-6 text-center animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="space-y-2">
                                {(previewUrl || formData.imageUrl) && (
                                    <img
                                        src={previewUrl || formData.imageUrl}
                                        alt="Token Icon"
                                        className="w-20 h-20 rounded-full mx-auto border-4 border-primary/20 object-cover"
                                    />
                                )}
                                <h3 className="text-xl font-bold">{formData.name} ({formData.symbol})</h3>
                                <p className="text-sm text-slate-400">{formData.description}</p>
                            </div>

                            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800 text-left space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Total Supply</span>
                                    <span>1,000,000,000</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Initial Buy</span>
                                    <span className="text-cyan-400">{formData.initialBuySOL} SOL</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Fee Split</span>
                                    <span className="text-green-400">100% Creator</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Platform</span>
                                    <span className="text-purple-400">Bags.fm</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Network</span>
                                    <span className={isMainnet ? 'text-green-400' : 'text-yellow-400'}>
                                        {isMainnet ? 'Solana Mainnet' : 'Solana Devnet (Mock)'}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Image Source</span>
                                    <span className="text-slate-300">{imageFile ? 'Upload' : 'URL'}</span>
                                </div>
                                {formData.twitter && (
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Twitter</span>
                                        <span className="text-slate-300 text-xs truncate max-w-[180px]">{formData.twitter}</span>
                                    </div>
                                )}
                                {formData.website && (
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Website</span>
                                        <span className="text-slate-300 text-xs truncate max-w-[180px]">{formData.website}</span>
                                    </div>
                                )}
                            </div>

                            {!isMainnet && (
                                <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-3 text-xs text-yellow-400/80">
                                    <AlertTriangle className="w-4 h-4 inline mr-1.5" />
                                    This will simulate a token launch. To deploy on mainnet, set <code className="bg-yellow-500/10 px-1 rounded">IS_MAINNET=true</code> and configure your <code className="bg-yellow-500/10 px-1 rounded">VITE_BAGS_API_KEY</code>.
                                </div>
                            )}
                        </div>
                    )}

                    {/* Navigation */}
                    <div className="flex justify-between mt-8 pt-4 border-t border-slate-800">
                        <div className="flex gap-2">
                            {step > 1 && (
                                <Button variant="secondary" onClick={handleBack} disabled={isLoading || isUploading}>
                                    Back
                                </Button>
                            )}
                        </div>
                        {step < 3 ? (
                            <Button onClick={handleNext} disabled={!formData.name || !formData.symbol}>
                                Continue
                            </Button>
                        ) : (
                            <Button
                                variant="primary"
                                onClick={handleSubmit}
                                isLoading={isLoading || isUploading}
                                className="px-8"
                            >
                                <Rocket className="mr-2 h-4 w-4" />
                                {isUploading ? 'Uploading...' : isMainnet ? 'Launch on Mainnet' : 'Launch (Devnet Mock)'}
                            </Button>
                        )}
                    </div>
                    {error && <p className="text-red-500 text-sm mt-4 text-center">{error.message}</p>}
                </CardContent>
            </Card>
        </div>
    );
};
