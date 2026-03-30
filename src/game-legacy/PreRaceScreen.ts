// ============================================================
// PreRaceScreen — Difficulty selection with Neon deposit
// ============================================================
//
// Canvas-rendered. Each card shows:
//   - Difficulty name + emoji
//   - Entry cost
//   - AI Speed
//   - Reward preview (1st/2nd/3rd)
//
// Unaffordable cards: greyed, lower opacity, click disabled
// On confirm: deducts entryCost, stores selected tier
// ============================================================

import {
    DifficultyTier,
    DifficultyConfig,
    DifficultyMeta,
    DIFFICULTIES,
    DIFFICULTY_META,
    TIER_ORDER,
} from './DifficultyConfig';

export class PreRaceScreen {
    private selectedIndex: number = 1; // Default: HARD
    private confirmed: boolean = false;
    private claimRequested: boolean = false;
    private tournamentRequested: boolean = false;
    private hoverIndex: number = -1;
    private cardRects: Array<{ x: number; y: number; w: number; h: number }> = [];
    private confirmRect = { x: 0, y: 0, w: 0, h: 0 };
    private claimRect = { x: 0, y: 0, w: 0, h: 0 };
    private tournamentRect = { x: 0, y: 0, w: 0, h: 0 };
    private insufficientFlash: number = 0;

    private mouseX: number = 0;
    private mouseY: number = 0;
    private canvas: HTMLCanvasElement | null = null;
    private boundMouseMove: ((e: MouseEvent) => void) | null = null;
    private boundClick: ((e: MouseEvent) => void) | null = null;
    private boundTouch: ((e: TouchEvent) => void) | null = null;

    // Win streak display
    winStreak: number = 0;

    private mode: 'CASUAL' | 'RANKED' = 'CASUAL';
    private toggleRect = { x: 0, y: 0, w: 0, h: 0 };

    init(canvas: HTMLCanvasElement): void {
        this.canvas = canvas;
        this.confirmed = false;
        this.insufficientFlash = 0;
        // Default to CASUAL?
        // Keep previous selection?
        // Resetting logic:
        this.mode = 'CASUAL';

        this.boundMouseMove = (e: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            this.mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
            this.mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
            this.updateHover();
        };

        this.boundClick = (e: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            this.mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
            this.mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
            this.handleClick();
        };

        this.boundTouch = (e: TouchEvent) => {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const t = e.touches[0] || e.changedTouches[0];
            if (t) {
                this.mouseX = (t.clientX - rect.left) * (canvas.width / rect.width);
                this.mouseY = (t.clientY - rect.top) * (canvas.height / rect.height);
                this.handleClick();
            }
        };

        canvas.addEventListener('mousemove', this.boundMouseMove);
        canvas.addEventListener('click', this.boundClick);
        canvas.addEventListener('touchstart', this.boundTouch);
    }

    destroy(): void {
        if (this.canvas) {
            if (this.boundMouseMove) this.canvas.removeEventListener('mousemove', this.boundMouseMove);
            if (this.boundClick) this.canvas.removeEventListener('click', this.boundClick);
            if (this.boundTouch) this.canvas.removeEventListener('touchstart', this.boundTouch);
        }
    }

    isConfirmed(): boolean { return this.confirmed; }
    isClaimRequested(): boolean { return this.claimRequested; }
    isTournamentRequested(): boolean { return this.tournamentRequested; }

    resetClaim(): void { this.claimRequested = false; }
    resetTournamentRequest(): void { this.tournamentRequested = false; }

    getSelectedTier(): DifficultyTier {
        if (this.mode === 'RANKED') return 'RANKED';
        return TIER_ORDER[this.selectedIndex];
    }

    reset(): void {
        this.confirmed = false;
        this.selectedIndex = 1;
        this.insufficientFlash = 0;
        this.insufficientFlash = 0;
        this.mode = 'CASUAL';
        this.tournamentRequested = false;
    }

    triggerInsufficientFlash(): void {
        this.insufficientFlash = 2.0;
        this.confirmed = false;
    }

    // ========== Rendering ==========

    render(ctx: CanvasRenderingContext2D, w: number, h: number, balance: number): void {
        // Background
        ctx.fillStyle = 'rgba(5, 5, 20, 0.93)';
        ctx.fillRect(0, 0, w, h);

        // Title
        ctx.font = `bold ${Math.min(42, w * 0.045)}px "Inter", sans-serif`;
        if (this.insufficientFlash > 0) {
            ctx.fillStyle = `rgba(255, 50, 50, ${Math.min(1, this.insufficientFlash)})`;
            this.insufficientFlash = Math.max(0, this.insufficientFlash - 0.05); // Decrement per frame
        } else {
            ctx.fillStyle = '#ffffff';
        }
        ctx.textAlign = 'center';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00e5ff';
        ctx.fillText('SELECT MODE', w / 2, h * 0.08); // Changed title
        ctx.shadowBlur = 0;

        // Balance
        ctx.font = `bold ${Math.min(24, w * 0.028)}px "Inter", sans-serif`;
        ctx.fillStyle = '#00e5ff';
        ctx.fillStyle = '#00e5ff';
        ctx.fillText(`💎 ${Math.floor(balance)} NEON`, w / 2, h * 0.135);

        // Tournament Button (Top Right)
        const tournW = 180;
        const tournH = 40;
        const tournX = w - tournW - 20;
        const tournY = 20;
        this.tournamentRect = { x: tournX, y: tournY, w: tournW, h: tournH };

        ctx.save();
        const tHover = this.isInRect(this.mouseX, this.mouseY, this.tournamentRect);
        ctx.fillStyle = tHover ? '#b8860b' : '#cca000'; // Gold-ish
        ctx.shadowBlur = tHover ? 15 : 0;
        ctx.shadowColor = '#ffd700';
        this.roundRect(ctx, tournX, tournY, tournW, tournH, 8);
        ctx.fill();
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 14px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🏆 TOURNAMENTS', tournX + tournW / 2, tournY + tournH / 2);
        ctx.restore();
        ctx.textBaseline = 'alphabetic'; // Reset

        // Mode Toggle
        const toggleW = 300;
        const toggleH = 40;
        const toggleX = (w - toggleW) / 2;
        const toggleY = h * 0.17;
        this.toggleRect = { x: toggleX, y: toggleY, w: toggleW, h: toggleH };

        // Toggle BG
        ctx.fillStyle = '#222';
        this.roundRect(ctx, toggleX, toggleY, toggleW, toggleH, 20);
        ctx.fill();

        // Active Pill
        ctx.fillStyle = this.mode === 'CASUAL' ? '#00e5ff' : '#a855f7';
        const pillX = this.mode === 'CASUAL' ? toggleX : toggleX + toggleW / 2;
        this.roundRect(ctx, pillX, toggleY, toggleW / 2, toggleH, 20);
        ctx.fill();

        // Text
        ctx.font = 'bold 16px "Inter", sans-serif';
        ctx.fillStyle = this.mode === 'CASUAL' ? '#000' : '#888';
        ctx.fillText("CASUAL", toggleX + toggleW / 4, toggleY + 26);
        ctx.fillStyle = this.mode === 'RANKED' ? '#fff' : '#888';
        ctx.fillText("RANKED", toggleX + toggleW * 0.75, toggleY + 26);


        // Win streak indicator (Only relevant for Casual? Or Ranked too?) 
        // Spec says Win Streak is for Neon reward multiplier. Ranked has Neon reward too.
        // Let's keep it.
        if (this.winStreak > 0) {
            ctx.font = `bold ${Math.min(16, w * 0.018)}px "Inter", sans-serif`;
            ctx.fillStyle = '#ffd700';
            ctx.fillText(`🔥 ${this.winStreak} Win Streak — +${this.winStreak * 5}% Bonus`, w / 2, h * 0.23);
        }

        this.cardRects = [];
        const cardY = h * 0.25; // Shifted down a bit

        if (this.mode === 'CASUAL') {
            const cardW = Math.min(210, w * 0.26);
            const cardH = Math.min(340, h * 0.56);
            const gap = Math.min(25, w * 0.025);
            const totalW = cardW * 3 + gap * 2;
            const startX = (w - totalW) / 2;

            for (let i = 0; i < 3; i++) {
                const tier = TIER_ORDER[i];
                const config = DIFFICULTIES[tier];
                const meta = DIFFICULTY_META[tier];
                const cx = startX + i * (cardW + gap);
                const isSelected = i === this.selectedIndex;
                const isHovered = i === this.hoverIndex;
                const canAfford = balance >= config.entryCost;

                this.cardRects.push({ x: cx, y: cardY, w: cardW, h: cardH });
                this.drawCard(ctx, cx, cardY, cardW, cardH, config, meta, isSelected, isHovered, canAfford);
            }
        } else {
            // RANKED MODE
            const cardW = Math.min(300, w * 0.4);
            const cardH = Math.min(360, h * 0.6);
            const cx = (w - cardW) / 2;

            const config = DIFFICULTIES['RANKED'];
            const meta = DIFFICULTY_META['RANKED'];
            // Ranked is always affordable (Entry Cost 0)
            const canAfford = true;

            // Auto-select
            // this.selectedIndex is irrelevant here, or we set it to -1

            this.cardRects.push({ x: cx, y: cardY, w: cardW, h: cardH }); // Index 0 of Ranked view
            this.drawCard(ctx, cx, cardY, cardW, cardH, config, meta, true, false, canAfford);
        }

        // ... Confirm Button logic handles selectedIndex ...
        // If Ranked, we don't depend on selectedIndex for tier, but confirm button uses existing pattern?
        // Let's check Confirm Render below.

        // Confirm button
        const btnW = Math.min(240, w * 0.28);
        const btnH = 50;
        const btnX = (w - btnW) / 2;
        const btnY = h * 0.88;
        this.confirmRect = { x: btnX, y: btnY, w: btnW, h: btnH };

        let selConfig, selMeta, canAffordSelected;

        if (this.mode === 'CASUAL') {
            selConfig = DIFFICULTIES[TIER_ORDER[this.selectedIndex]];
            selMeta = DIFFICULTY_META[TIER_ORDER[this.selectedIndex]];
            canAffordSelected = balance >= selConfig.entryCost;
        } else {
            selConfig = DIFFICULTIES['RANKED'];
            selMeta = DIFFICULTY_META['RANKED'];
            canAffordSelected = true;
        }

        this.drawConfirmBtn(ctx, btnX, btnY, btnW, btnH, selConfig, selMeta, canAffordSelected);

        // ... Claim button logic ...
        if (balance < 10) {
            // ... (keep logic)
            const claimW = 200;
            const claimH = 40;
            const claimX = (w - claimW) / 2;
            const claimY = btnY - 60;
            this.claimRect = { x: claimX, y: claimY, w: claimW, h: claimH };

            ctx.save();
            ctx.fillStyle = this.isInRect(this.mouseX, this.mouseY, this.claimRect) ? '#00ff00' : 'rgba(0, 255, 0, 0.7)';
            this.roundRect(ctx, claimX, claimY, claimW, claimH, 8);
            ctx.fill();

            ctx.font = 'bold 16px "Inter", sans-serif';
            ctx.fillStyle = '#000000';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🎁 CLAIM FREE NEON', claimX + claimW / 2, claimY + claimH / 2);
            ctx.restore();
        } else {
            this.claimRect = { x: 0, y: 0, w: 0, h: 0 };
        }

        // Pot Info
        ctx.font = `${Math.min(13, w * 0.015)}px "Inter", sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.textAlign = 'center';
        ctx.fillText(`Race pot: ${selConfig.entryCost * 6} 💎 (6 racers × ${selConfig.entryCost})`, w / 2, h * 0.96);
    }

    private drawCard(
        ctx: CanvasRenderingContext2D,
        x: number, y: number, w: number, h: number,
        config: DifficultyConfig, meta: DifficultyMeta,
        isSelected: boolean, isHovered: boolean, canAfford: boolean
    ): void {
        ctx.save();

        const alpha = canAfford ? (isSelected ? 0.22 : isHovered ? 0.12 : 0.06) : 0.03;
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.strokeStyle = isSelected ? meta.color : (canAfford ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)');
        ctx.lineWidth = isSelected ? 2.5 : 1;

        this.roundRect(ctx, x, y, w, h, 12);
        ctx.fill();
        ctx.stroke();

        if (isSelected) {
            ctx.shadowBlur = 25;
            ctx.shadowColor = meta.glowColor;
            this.roundRect(ctx, x, y, w, h, 12);
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        const ta = canAfford ? 1 : 0.25;
        const cx = x + w / 2;
        let ty = y + 32;

        // Emoji
        ctx.font = 'bold 30px sans-serif';
        ctx.fillStyle = `rgba(255,255,255,${ta})`;
        ctx.textAlign = 'center';
        ctx.fillText(meta.emoji, cx, ty);
        ty += 32;

        // Label
        ctx.font = `bold ${Math.min(24, w * 0.11)}px "Inter", sans-serif`;
        ctx.fillStyle = canAfford ? meta.color : `rgba(150,150,150,0.3)`;
        ctx.fillText(meta.label, cx, ty);
        ty += 35;

        // Entry cost
        ctx.font = `bold ${Math.min(13, w * 0.06)}px "Inter", sans-serif`;
        ctx.fillStyle = `rgba(255,255,255,${ta * 0.5})`;
        ctx.fillText('ENTRY COST', cx, ty);
        ty += 20;
        ctx.font = `bold ${Math.min(26, w * 0.12)}px "Inter", sans-serif`;
        ctx.fillStyle = canAfford ? '#00e5ff' : 'rgba(255,80,80,0.4)';
        ctx.fillText(`${config.entryCost} 💎`, cx, ty);
        ty += 30;

        // AI Speed
        ctx.font = `bold ${Math.min(12, w * 0.055)}px "Inter", sans-serif`;
        ctx.fillStyle = `rgba(255,255,255,${ta * 0.4})`;
        ctx.fillText(`AI SPEED: ${config.aiMaxSpeed}`, cx, ty);
        ty += 28;

        // Rewards header
        ctx.font = `bold ${Math.min(12, w * 0.055)}px "Inter", sans-serif`;
        ctx.fillStyle = `rgba(255,255,255,${ta * 0.45})`;
        ctx.fillText('REWARDS', cx, ty);
        ty += 20;

        // Reward rows
        const rewards = [
            { pos: '🥇 1st', amt: config.rewards[1] },
            { pos: '🥈 2nd', amt: config.rewards[2] },
            { pos: '🥉 3rd', amt: config.rewards[3] },
        ];

        ctx.font = `${Math.min(14, w * 0.065)}px "Inter", sans-serif`;
        for (const r of rewards) {
            ctx.textAlign = 'left';
            ctx.fillStyle = `rgba(255,255,255,${ta * 0.6})`;
            ctx.fillText(r.pos, x + w * 0.12, ty);
            ctx.textAlign = 'right';
            ctx.fillStyle = r.amt > 0 ? `rgba(0,255,136,${ta})` : `rgba(255,80,80,${ta * 0.4})`;
            ctx.fillText(r.amt > 0 ? `+${r.amt} 💎` : '0', x + w * 0.88, ty);
            ty += 20;
        }

        ty += 8;

        // Description
        ctx.font = `italic ${Math.min(11, w * 0.052)}px "Inter", sans-serif`;
        ctx.fillStyle = `rgba(255,255,255,${ta * 0.35})`;
        ctx.textAlign = 'center';
        ctx.fillText(meta.description, cx, ty);

        ctx.restore();
    }

    private drawConfirmBtn(
        ctx: CanvasRenderingContext2D,
        x: number, y: number, w: number, h: number,
        config: DifficultyConfig, meta: DifficultyMeta, canAfford: boolean
    ): void {
        ctx.save();
        const hover = this.isInRect(this.mouseX, this.mouseY, { x, y, w, h });

        if (canAfford) {
            ctx.fillStyle = hover ? meta.color : this.darken(meta.color, 0.7);
            ctx.shadowBlur = hover ? 18 : 0;
            ctx.shadowColor = meta.color;
        } else {
            ctx.fillStyle = 'rgba(80, 80, 80, 0.25)';
        }

        this.roundRect(ctx, x, y, w, h, 10);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.font = 'bold 18px "Inter", sans-serif';
        ctx.fillStyle = canAfford ? '#ffffff' : 'rgba(255,255,255,0.25)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
            canAfford ? `RACE — ${config.entryCost} 💎` : 'INSUFFICIENT NEON',
            x + w / 2, y + h / 2
        );

        ctx.restore();
    }

    // ========== Interaction ==========

    private updateHover(): void {
        this.hoverIndex = -1;
        for (let i = 0; i < this.cardRects.length; i++) {
            if (this.isInRect(this.mouseX, this.mouseY, this.cardRects[i])) {
                this.hoverIndex = i;
                break;
            }
        }
    }

    private handleClick(): void {
        // Mode Toggle
        if (this.isInRect(this.mouseX, this.mouseY, this.toggleRect)) {
            this.mode = this.mode === 'CASUAL' ? 'RANKED' : 'CASUAL';
            // Reset selection to default when switching?
            if (this.mode === 'CASUAL') this.selectedIndex = 1;
            // Don't return, let it fall through? No, toggle area shouldn't select cards.
            return;
        }

        // Card selection (always allowed even if can't afford — just visually select)
        for (let i = 0; i < this.cardRects.length; i++) {
            if (this.isInRect(this.mouseX, this.mouseY, this.cardRects[i])) {
                this.selectedIndex = i;
                return;
            }
        }

        // Confirm button
        if (this.isInRect(this.mouseX, this.mouseY, this.confirmRect)) {
            console.log('[PreRaceScreen] Confirm button clicked');
            this.confirmed = true; // GameEngine validates balance
            return;
        }

        // Claim button
        if (this.claimRect.w > 0 && this.isInRect(this.mouseX, this.mouseY, this.claimRect)) {
            this.claimRequested = true;
        }

        // Tournament button
        if (this.isInRect(this.mouseX, this.mouseY, this.tournamentRect)) {
            this.tournamentRequested = true;
        }
    }

    private isInRect(mx: number, my: number, r: { x: number; y: number; w: number; h: number }): boolean {
        return mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h;
    }

    // ========== Helpers ==========

    private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    private darken(hex: string, factor: number): string {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgb(${Math.floor(r * factor)},${Math.floor(g * factor)},${Math.floor(b * factor)})`;
    }
}
