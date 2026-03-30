import { MatchHub } from './MatchHub';
import { SwapPanel } from './swap/SwapPanel';
import { TokenExplorer } from './swap/TokenExplorer';

export const Dashboard = () => {

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Stats & Overview */}
            <div className="lg:col-span-2 space-y-8">
                <MatchHub />
                
                {/* Token Discovery */}
                <div className="pt-4 border-t border-slate-800/50">
                    <TokenExplorer />
                </div>
            </div>

            {/* Right Column: Trading Panel */}
            <div className="lg:col-span-1">
                <div className="bg-slate-900/40 rounded-2xl border border-slate-800/50 p-6 backdrop-blur-xl sticky top-24">
                    <SwapPanel />
                </div>
            </div>
        </div>
    );
};
