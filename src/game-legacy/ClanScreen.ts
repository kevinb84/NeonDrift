
import { ClanManager, Clan } from './ClanManager';

import { GameEngine } from './GameEngine';

export class ClanScreen {
    private engine: GameEngine;
    private clanManager: ClanManager;

    private activeTab: 'overview' | 'members' | 'vault' = 'overview';
    private createName: string = '';
    private createTag: string = '';
    private joinId: string = '';
    private inputFocus: 'none' | 'createName' | 'createTag' | 'joinId' = 'none';

    private buttons: Array<{ x: number, y: number, w: number, h: number, text: string, action: () => void }> = [];

    // Keys
    private handleKeyDown = (e: KeyboardEvent) => {
        if (this.inputFocus === 'none') return;

        if (e.key === 'Backspace') {
            if (this.inputFocus === 'createName') this.createName = this.createName.slice(0, -1);
            if (this.inputFocus === 'createTag') this.createTag = this.createTag.slice(0, -1);
            if (this.inputFocus === 'joinId') this.joinId = this.joinId.slice(0, -1);
        } else if (e.key.length === 1) {
            if (this.inputFocus === 'createName' && this.createName.length < 12) this.createName += e.key;
            if (this.inputFocus === 'createTag' && this.createTag.length < 4) this.createTag += e.key.toUpperCase();
            if (this.inputFocus === 'joinId' && this.joinId.length < 10) this.joinId += e.key;
        }
    };

    constructor(engine: GameEngine, manager: ClanManager) {
        this.engine = engine;
        this.clanManager = manager;

        window.addEventListener('keydown', this.handleKeyDown);
    }

    public dispose() {
        window.removeEventListener('keydown', this.handleKeyDown);
    }

    public render(ctx: CanvasRenderingContext2D, w: number, h: number): void {
        this.buttons = [];

        // Background
        ctx.fillStyle = '#050510';
        ctx.fillRect(0, 0, w, h);

        // Header
        ctx.font = 'bold 32px "Inter", sans-serif';
        ctx.fillStyle = '#FFD700';
        ctx.textAlign = 'center';
        ctx.fillText('CLAN HUB', w / 2, 50);

        // Back Button
        this.drawButton(ctx, 20, 20, 100, 40, '← BACK', () => {
            // Go back to main menu loop in GameEngine
            this.engine.phase = 'select-difficulty';
        });

        const myClan = this.clanManager.getPlayerClan('Guest'); // Hardcoded ID for now

        if (!myClan) {
            this.renderNoClanView(ctx, w, h);
        } else {
            this.renderClanView(ctx, w, h, myClan);
        }
    }

    private renderNoClanView(ctx: CanvasRenderingContext2D, w: number, h: number): void {
        const cx = w / 2;
        const cy = h / 2;

        // Create Clan Section
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(cx - 300, cy - 200, 280, 400);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 24px "Inter", sans-serif';
        ctx.fillText('CREATE CLAN', cx - 160, cy - 160);

        // Name Input
        this.drawInput(ctx, cx - 280, cy - 120, 240, 40, 'Name', this.createName, 'createName');
        // Tag Input
        this.drawInput(ctx, cx - 280, cy - 60, 240, 40, 'Tag (2-4)', this.createTag, 'createTag');

        ctx.fillStyle = '#aaa';
        ctx.font = '16px "Inter", sans-serif';
        ctx.fillText('Cost: 500 Neon', cx - 160, cy - 10);

        this.drawButton(ctx, cx - 230, cy + 20, 140, 40, 'CREATE', () => {
            const res = this.clanManager.createClan(this.createName, this.createTag, 'Guest');
            if (res.success) {
                alert(res.message);
                this.createName = '';
                this.createTag = '';
            } else {
                alert(res.message);
            }
        });


        // Join Clan Section
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(cx + 20, cy - 200, 280, 400);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 24px "Inter", sans-serif';
        ctx.fillText('JOIN CLAN', cx + 160, cy - 160);

        // List some clans
        const allClans = this.clanManager.getAllClans().slice(0, 5);
        let y = cy - 100;

        if (allClans.length === 0) {
            ctx.fillStyle = '#666';
            ctx.font = 'italic 16px "Inter", sans-serif';
            ctx.fillText('No clans created yet', cx + 160, y);
        } else {
            allClans.forEach(c => {
                ctx.fillStyle = '#ccc';
                ctx.textAlign = 'left';
                ctx.font = '16px "Inter", sans-serif';
                ctx.fillText(`[${c.tag}] ${c.name}`, cx + 40, y);

                this.drawButton(ctx, cx + 220, y - 20, 60, 30, 'JOIN', () => {
                    const res = this.clanManager.joinClan(c.clanId, 'Guest');
                    alert(res.message);
                });
                y += 50;
            });
        }
    }

    private renderClanView(ctx: CanvasRenderingContext2D, w: number, h: number, clan: Clan): void {
        // Tabs
        const tabs = ['overview', 'members', 'vault'];
        let tx = w / 2 - 150;
        tabs.forEach(t => {
            const isActive = this.activeTab === t;
            this.drawButton(ctx, tx, 80, 100, 30, t.toUpperCase(), () => this.activeTab = t as any, isActive ? '#00e5ff' : '#333');
            tx += 110;
        });

        const cx = w / 2;
        const cy = h / 2;

        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 48px "Inter", sans-serif';
        ctx.fillText(`[${clan.tag}] ${clan.name}`, cx, 160);

        if (this.activeTab === 'overview') {
            ctx.font = '24px "Inter", sans-serif';
            ctx.fillStyle = '#aaa';
            ctx.fillText(`Members: ${clan.members.length} / 20`, cx, 220);
            ctx.fillText(`Vault: ${clan.clanNeonVault} Neon`, cx, 260);

            this.drawButton(ctx, cx - 60, cy + 100, 120, 40, 'LEAVE CLAN', () => {
                const res = this.clanManager.leaveClan('Guest');
                alert(res.message);
            }, '#ff4444');

        } else if (this.activeTab === 'members') {
            let y = 220;
            clan.members.forEach((m, i) => {
                ctx.font = '18px "Inter", sans-serif';
                ctx.fillStyle = m === clan.leaderId ? '#FFD700' : '#fff';
                ctx.fillText(`${i + 1}. ${m} ${m === clan.leaderId ? '(Leader)' : ''}`, cx, y);
                y += 30;
            });

        } else if (this.activeTab === 'vault') {
            ctx.font = '64px "Inter", sans-serif';
            ctx.fillStyle = '#00e5ff';
            ctx.fillText(`${clan.clanNeonVault}`, cx, 240);
            ctx.font = '24px "Inter", sans-serif';
            ctx.fillStyle = '#fff';
            ctx.fillText('NEON VAULT', cx, 280);

            this.drawButton(ctx, cx - 80, 320, 160, 40, 'DONATE 100', () => {
                const res = this.clanManager.donate('Guest', 100);
                alert(res.message);
            });
        }
    }

    private drawButton(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, text: string, action: () => void, color: string = '#444'): void {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, w, h);

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x + w / 2, y + h / 2);

        this.buttons.push({ x, y, w, h, text, action });
    }

    private drawInput(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, placeholder: string, value: string, focusId: any): void {
        const isFocused = this.inputFocus === focusId;
        ctx.fillStyle = isFocused ? '#333' : '#111';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = isFocused ? '#00e5ff' : '#666';
        ctx.strokeRect(x, y, w, h);

        ctx.fillStyle = value ? '#fff' : '#666';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = '16px "Inter", sans-serif';
        ctx.fillText(value || placeholder, x + 10, y + h / 2);

        this.buttons.push({ x, y, w, h, text: '', action: () => this.inputFocus = focusId });
    }

    public handleClick(x: number, y: number): void {
        // Reset focus on click (unless clicked input)
        this.inputFocus = 'none';

        for (const btn of this.buttons) {
            if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
                this.engine['soundManager'].playUIClick();
                btn.action();
                return;
            }
        }
    }
}
