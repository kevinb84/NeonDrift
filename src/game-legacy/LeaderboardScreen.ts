import { LeaderboardManager, RaceResult, PlayerStats } from './LeaderboardManager';
import { SeasonManager } from './SeasonManager';

type LeaderboardTab = 'TRACK' | 'NEON' | 'RANKED' | 'WINRATE' | 'SEASON';

export class LeaderboardScreen {
    private trackScores: RaceResult[] = [];
    private globalStats: PlayerStats[] = [];
    private loading: boolean = false;
    private trackName: string = '';
    private difficulty: string = '';

    private currentTab: LeaderboardTab = 'TRACK';
    private tabs: { id: LeaderboardTab; label: string }[] = [
        { id: 'TRACK', label: 'Track' },
        { id: 'NEON', label: 'Neon' },
        { id: 'RANKED', label: 'Ranked' },
        { id: 'WINRATE', label: 'Win Rate' },
        { id: 'SEASON', label: 'Season' }
    ];

    // Interaction
    private mouseX = 0;
    private mouseY = 0;
    private tabRects: Array<{ x: number, y: number, w: number, h: number, id: LeaderboardTab }> = [];

    // State
    private seasonTimeRemaining: string = "";

    constructor() {
        // Auto-refresh season timer
        setInterval(() => {
            this.seasonTimeRemaining = SeasonManager.getTimeRemaining();
        }, 60000);
        this.seasonTimeRemaining = SeasonManager.getTimeRemaining();
    }

    setScores(scores: RaceResult[], track: string, diff: string) {
        this.trackScores = scores;
        this.trackName = track;
        this.difficulty = diff;
        this.currentTab = 'TRACK'; // Default to track when opened via Game
        this.loading = false;
    }

    setLoading(loading: boolean) {
        this.loading = loading;
    }

    handleInput(input: any) {
        if (input.mouse) {
            this.mouseX = input.mouse.x;
            this.mouseY = input.mouse.y;

            if (input.mouse.click) {
                // Check Tabs
                for (const t of this.tabRects) {
                    if (this.mouseX >= t.x && this.mouseX <= t.x + t.w &&
                        this.mouseY >= t.y && this.mouseY <= t.y + t.h) {
                        this.switchTab(t.id);
                        break;
                    }
                }
            }
        }
    }

    private switchTab(tab: LeaderboardTab) {
        this.currentTab = tab;
        if (tab !== 'TRACK') {
            this.fetchGlobalData(tab);
        }
    }

    private fetchGlobalData(tab: LeaderboardTab) {
        this.globalStats = [];
        // Simulate fetch delay?
        switch (tab) {
            case 'NEON':
                this.globalStats = LeaderboardManager.getTopNeonHolders();
                break;
            case 'RANKED':
                this.globalStats = LeaderboardManager.getTopRankedPlayers();
                break;
            case 'WINRATE':
                this.globalStats = LeaderboardManager.getTopWinRatePlayers();
                break;
            case 'SEASON':
                // For now, Season just shows Ranked? Or maybe Season Archive?
                // Spec says "Season" tab. Let's show Ranked for current season.
                this.globalStats = LeaderboardManager.getTopRankedPlayers();
                break;
        }
    }

    render(ctx: CanvasRenderingContext2D, w: number, h: number) {
        // Overlay background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.92)';
        ctx.fillRect(0, 0, w, h);

        // Header
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';

        ctx.font = 'bold 32px "Inter", sans-serif';
        ctx.fillText('LEADERBOARD', w / 2, 50);

        // Season Timer
        ctx.font = '14px "Inter", sans-serif';
        ctx.fillStyle = '#00e5ff';
        ctx.fillText(`SEASON ENDS IN: ${this.seasonTimeRemaining}`, w / 2, 75);

        // Tabs
        this.drawTabs(ctx, w, 100);

        // Sub-header (Track Info)
        if (this.currentTab === 'TRACK') {
            ctx.font = '16px "Inter", sans-serif';
            ctx.fillStyle = '#aaaaaa';
            ctx.textAlign = 'center';
            ctx.fillText(`${this.trackName} • ${this.difficulty}`, w / 2, 160);
        }

        // Loading state
        if (this.loading) {
            ctx.font = '24px "Inter", sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.fillText('Loading...', w / 2, h / 2);
            return;
        }

        this.drawTable(ctx, w);

        // Close Hint
        ctx.font = '14px "Inter", sans-serif';
        ctx.fillStyle = '#666666';
        ctx.textAlign = 'center';
        ctx.fillText('Press [ESC] to Close', w / 2, h - 30);
    }

    private drawTabs(ctx: CanvasRenderingContext2D, w: number, y: number) {
        const tabW = 120;
        const tabH = 35;
        const totalW = this.tabs.length * tabW;
        const startX = (w - totalW) / 2;

        this.tabRects = [];

        this.tabs.forEach((tab, i) => {
            const x = startX + i * tabW;
            const isSelected = this.currentTab === tab.id;

            this.tabRects.push({ x, y, w: tabW, h: tabH, id: tab.id });

            // BG
            ctx.fillStyle = isSelected ? '#00e5ff' : '#222222';
            if (this.mouseX >= x && this.mouseX <= x + tabW && this.mouseY >= y && this.mouseY <= y + tabH) {
                if (!isSelected) ctx.fillStyle = '#333333';
            }

            ctx.fillRect(x, y, tabW, tabH);

            // Text
            ctx.fillStyle = isSelected ? '#000000' : '#888888';
            ctx.font = isSelected ? 'bold 14px "Inter", sans-serif' : '14px "Inter", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(tab.label, x + tabW / 2, y + tabH / 2);

            // Border
            ctx.strokeStyle = '#333333';
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, tabW, tabH);
        });

        ctx.textBaseline = 'alphabetic'; // Reset
    }

    private drawTable(ctx: CanvasRenderingContext2D, w: number) {
        const startY = 200;
        const rowH = 40;
        const colRank = w / 2 - 200;
        const colName = w / 2 - 50;
        const colVal = w / 2 + 150;

        // Header
        ctx.font = 'bold 14px "Inter", sans-serif';
        ctx.fillStyle = '#666666';
        ctx.textAlign = 'right'; ctx.fillText('RANK', colRank - 20, startY);
        ctx.textAlign = 'left'; ctx.fillText('PLAYER', colName, startY);
        ctx.textAlign = 'right';

        let valLabel = 'TIME';
        if (this.currentTab === 'NEON') valLabel = 'BALANCE';
        else if (this.currentTab === 'RANKED') valLabel = 'RP';
        else if (this.currentTab === 'WINRATE') valLabel = 'WIN RATE';
        else if (this.currentTab === 'SEASON') valLabel = 'SEASON RP';

        ctx.fillText(valLabel, colVal + 20, startY);

        // Separator
        ctx.beginPath();
        ctx.moveTo(w / 2 - 250, startY + 10);
        ctx.lineTo(w / 2 + 250, startY + 10);
        ctx.strokeStyle = '#333333';
        ctx.stroke();

        // Data
        const list = this.currentTab === 'TRACK' ? this.trackScores : this.globalStats;

        if (list.length === 0) {
            ctx.font = '18px "Inter", sans-serif';
            ctx.fillStyle = '#444';
            ctx.textAlign = 'center';
            ctx.fillText('No data available', w / 2, startY + 60);
            return;
        }

        ctx.font = '16px "Inter", sans-serif';
        list.slice(0, 10).forEach((item, index) => {
            const y = startY + 40 + (index * rowH);

            // Rank Color
            if (index === 0) {
                ctx.shadowBlur = 10; ctx.shadowColor = '#ffd700'; ctx.fillStyle = '#ffd700';
            } else if (index === 1) {
                ctx.shadowBlur = 10; ctx.shadowColor = '#c0c0c0'; ctx.fillStyle = '#c0c0c0';
            } else if (index === 2) {
                ctx.shadowBlur = 10; ctx.shadowColor = '#cd7f32'; ctx.fillStyle = '#cd7f32';
            } else {
                ctx.shadowBlur = 0; ctx.fillStyle = '#ffffff';
            }

            ctx.textAlign = 'right';
            ctx.fillText(`#${index + 1}`, colRank - 20, y);
            ctx.shadowBlur = 0;

            // Name & Value
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'left';

            let name = 'Unknown';
            let val = '';

            if (this.currentTab === 'TRACK') {
                const r = item as RaceResult;
                name = r.wallet_address ? (r.wallet_address.slice(0, 6) + '...' + r.wallet_address.slice(-4)) : 'Anonymous';
                val = this.formatTime(r.time_ms);
            } else {
                const p = item as PlayerStats;
                name = p.playerId.length > 20 ? (p.playerId.slice(0, 15) + '...') : p.playerId;

                if (this.currentTab === 'NEON') val = `💎 ${p.neonBalance.toLocaleString()}`;
                else if (this.currentTab === 'RANKED') val = `${p.rankPoints} RP`;
                else if (this.currentTab === 'WINRATE') {
                    const rate = p.totalRaces > 0 ? (p.wins / p.totalRaces * 100).toFixed(1) : '0.0';
                    val = `${rate}% (${p.wins}W/${p.losses}L)`;
                } else {
                    val = `${p.rankPoints} RP`;
                }
            }

            ctx.fillText(name, colName, y);

            ctx.textAlign = 'right';
            ctx.fillStyle = '#00e5ff';
            ctx.fillText(val, colVal + 20, y);
        });
    }

    private formatTime(ms: number): string {
        const totalSec = Math.floor(ms / 1000);
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        const mil = Math.floor((ms % 1000) / 10);
        return `${m}:${s.toString().padStart(2, '0')}.${mil.toString().padStart(2, '0')}`;
    }
}
