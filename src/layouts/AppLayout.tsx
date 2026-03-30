import { Link, useLocation } from 'react-router-dom';
import { WalletButton } from '../components/wallet/WalletButton';
import { cn } from '../lib/utils';
import { LayoutDashboard, PlusCircle, User, Gamepad2, UploadCloud, Loader2 } from 'lucide-react';
import { IS_MAINNET } from '../services/BlueprintService';
import { useState, useRef } from 'react';
import { insforge } from '../lib/insforge';
import { useProfile } from '../hooks/useProfile';

interface AppLayoutProps {
    children: React.ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
    const location = useLocation();
    const { profile } = useProfile();

    const [logoUrl, setLogoUrl] = useState<string>(() => {
        return insforge.storage.from('assets').getPublicUrl('app-logo') || '/logo.png';
    });
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        try {
            if (!e.target.files || e.target.files.length === 0) return;
            setUploadingLogo(true);
            const file = e.target.files[0];
            
            const { error } = await insforge.storage
                .from('assets')
                .upload('app-logo', file);

            if (error) throw error;
            
            const publicUrl = insforge.storage.from('assets').getPublicUrl('app-logo');
            if (publicUrl) {
                setLogoUrl(`${publicUrl}?t=${Date.now()}`); // cache buster
            }
        } catch (err) {
            console.error("Failed to upload app logo:", err);
            alert("Error uploading app logo!");
        } finally {
            setUploadingLogo(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const navItems = [
        { name: 'Home', path: '/', icon: LayoutDashboard },
        { name: 'Dashboard', path: '/dashboard', icon: Gamepad2 },
        { name: 'Race', path: '/game', icon: Gamepad2 },
        { name: 'Profile', path: '/profile', icon: User },
    ];

    if (profile?.is_admin) {
        navItems.push({ name: 'Admin', path: '/create', icon: PlusCircle });
    }

    return (
        <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/30">
            {/* Top Navigation */}
            <header className="sticky top-0 z-40 w-full border-b border-white/5 bg-background/80 backdrop-blur-md">
                <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center gap-8">
                        <div className="flex items-center gap-3 relative group">
                            <Link to="/" className="flex items-center gap-3" title="Go to Dashboard">
                                <div className="relative w-8 h-8 rounded overflow-hidden flex items-center justify-center shrink-0">
                                    {uploadingLogo ? (
                                        <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                                    ) : (
                                        <img 
                                            src={logoUrl} 
                                            alt="NeonDrift Logo" 
                                            className="w-full h-full object-contain"
                                            onError={(e) => {
                                                if ((e.target as HTMLImageElement).src !== window.location.origin + '/logo.png') {
                                                    (e.target as HTMLImageElement).src = '/logo.png';
                                                }
                                            }}
                                        />
                                    )}
                                </div>
                                <span className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                                    NeonDrift
                                </span>
                            </Link>

                            {profile?.is_admin && (
                                <>
                                    <button 
                                        type="button" 
                                        onClick={(e) => { e.preventDefault(); fileInputRef.current?.click(); }}
                                        className="absolute -bottom-2 -left-2 bg-slate-900 hover:bg-slate-800 p-1 rounded-full text-slate-400 hover:text-white border border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-lg"
                                        title="Change App Logo"
                                    >
                                        <UploadCloud size={14} />
                                    </button>
                                    <input 
                                        type="file" 
                                        ref={fileInputRef} 
                                        accept="image/*" 
                                        className="hidden" 
                                        onChange={handleLogoUpload} 
                                    />
                                </>
                            )}
                        </div>

                        <nav className="hidden md:flex items-center gap-1">
                            {navItems.map((item) => {
                                const isActive = location.pathname === item.path;
                                return (
                                    <Link key={item.path} to={item.path}>
                                        <div className={cn(
                                            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                                            isActive
                                                ? "bg-white/10 text-white shadow-sm ring-1 ring-white/10"
                                                : "text-slate-400 hover:text-white hover:bg-white/5"
                                        )}>
                                            <item.icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-slate-400")} />
                                            {item.name}
                                        </div>
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="hidden sm:flex items-center gap-4 text-sm text-slate-400">
                            {IS_MAINNET ? (
                                <span className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 px-2 py-1 rounded-full text-xs font-medium text-green-400">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                                    <span>Mainnet</span>
                                </span>
                            ) : (
                                <span className="flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/20 px-2 py-1 rounded-full text-xs font-medium text-yellow-400">
                                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse"></span>
                                    <span>Devnet</span>
                                </span>
                            )}
                        </div>
                        <WalletButton />
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {children}
            </main>

            {/* Footer */}
            <footer className="border-t border-white/5 bg-black/20 mt-auto">
                <div className="container mx-auto px-4 py-8 text-center text-sm text-slate-500">
                    <p>© 2026 NeonConfig. Powered by Bags</p>
                </div>
            </footer>
        </div>
    );
};
