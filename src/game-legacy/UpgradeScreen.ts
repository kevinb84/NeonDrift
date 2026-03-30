import { UpgradeManager, UpgradeType } from './UpgradeManager';
import { NeonBalanceManager } from './NeonBalanceManager';
import { InputManager } from './InputManager';

export class UpgradeScreen {
    private upgradeManager: UpgradeManager;
    private balanceManager: NeonBalanceManager;

    private selectedIndex: number = 0; // 0: Engine, 1: Tires, 2: Nitro
    private upgradeTypes: UpgradeType[] = ['ENGINE', 'TIRES', 'NITRO'];

    // UI Constants
    private cardWidth = 220;
    private cardHeight = 300;
    private spacing = 40;

    constructor(upgradeManager: UpgradeManager, balanceManager: NeonBalanceManager) {
        this.upgradeManager = upgradeManager;
        this.balanceManager = balanceManager;
    }

    handleInput(input: InputManager): void {
        const state = input.getState();

        // Navigation (Left/Right)
        if (state.left && !input.prevLeft) {
            this.selectedIndex = (this.selectedIndex - 1 + 3) % 3;
            // Play sound?
        }
        if (state.right && !input.prevRight) {
            this.selectedIndex = (this.selectedIndex + 1) % 3;
        }

        // Purchase (Enter/Space)
        if ((state.keys && (state.keys['Enter'] || state.keys['Space'])) || state.nitro /* mobile tap? */) {
            // Debounce needed in GameEngine or here? 
            // Usually GameEngine handles simple debouncing or we check prev state if passed
            // For now assuming GameEngine calls this only once per press if we track prev keys? 
            // Actually input.getState() returns current frame state. 
            // We need a 'justPressed' check. GameEngine inputs usually have prevLeft but not generic prevKey for all keys.
            // Let's rely on GameEngine to handle the specialized 'action' input or strict key check.
            // But here we are passed 'InputManager'.
            // Let's check specific key with debounce logic if possible, or just use a cooldown.
        }
    }

    // Alternative: GameEngine calls 'action()' when Enter is pressed.
    purchaseSelected(): boolean {
        const type = this.upgradeTypes[this.selectedIndex];
        return this.upgradeManager.purchaseUpgrade(type);
    }

    render(ctx: CanvasRenderingContext2D, w: number, h: number): void {
        // Title
        ctx.textAlign = 'center';
        ctx.font = 'bold 36px "Inter", sans-serif';
        ctx.fillStyle = '#ff0055'; // Different color for Upgrades? Or consistent Blue?
        ctx.shadowColor = '#ff0055'; ctx.shadowBlur = 15;
        ctx.fillText("PERFORMANCE SHOP", w / 2, 80);
        ctx.shadowBlur = 0;

        // Balance
        ctx.textAlign = 'right';
        ctx.font = 'bold 24px "Inter", sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText(`${Math.floor(this.balanceManager.getBalance())} 💎`, w - 40, 80);

        // Cards
        const totalW = 3 * this.cardWidth + 2 * this.spacing;
        let startX = (w - totalW) / 2;
        const startY = h / 2 - this.cardHeight / 2;

        this.upgradeTypes.forEach((type, index) => {
            this.renderCard(ctx, type, startX, startY, index === this.selectedIndex);
            startX += this.cardWidth + this.spacing;
        });

        // Instructions
        ctx.textAlign = 'center';
        ctx.font = '16px "Inter", sans-serif';
        ctx.fillStyle = '#888';
        ctx.fillText("← / → Select   |   ENTER / 🟢 Buy Upgrade   |   ESC Back", w / 2, h - 50);
    }

    private renderCard(ctx: CanvasRenderingContext2D, type: UpgradeType, x: number, y: number, isSelected: boolean): void {
        const level = this.upgradeManager.getUpgradeLevel(type);
        const cost = this.upgradeManager.getUpgradeCost(type);
        const isMaxed = level >= 5;
        const canAfford = cost !== null && this.balanceManager.canAfford(cost);

        // Background
        ctx.fillStyle = isSelected ? 'rgba(30, 30, 40, 0.9)' : 'rgba(20, 20, 30, 0.8)';
        ctx.strokeStyle = isSelected ? '#00e5ff' : '#444';
        ctx.lineWidth = isSelected ? 3 : 1;

        ctx.beginPath();
        ctx.roundRect(x, y, this.cardWidth, this.cardHeight, 12);
        ctx.fill();
        ctx.stroke();

        if (isSelected) {
            ctx.shadowColor = '#00e5ff';
            ctx.shadowBlur = 20;
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        // Icon / Title
        const title = type;
        const emoji = type === 'ENGINE' ? '⚡' : type === 'TIRES' ? '🍩' : '🔥';

        ctx.textAlign = 'center';
        ctx.font = '32px "Inter", sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText(emoji, x + this.cardWidth / 2, y + 50);

        ctx.font = 'bold 20px "Inter", sans-serif';
        ctx.fillText(title, x + this.cardWidth / 2, y + 85);

        // Level Dots
        this.renderLevelDots(ctx, level, x + this.cardWidth / 2, y + 115);

        // Stat Preview
        ctx.font = '14px "Inter", sans-serif';
        ctx.fillStyle = '#aaa';
        const previewText = this.upgradeManager.getNextLevelPreview(type);
        ctx.fillText(isMaxed ? "MAX PERFORMANCE" : "Next Level:", x + this.cardWidth / 2, y + 150);

        if (!isMaxed) {
            ctx.font = 'bold 16px "Inter", sans-serif';
            ctx.fillStyle = '#00ff88';
            ctx.fillText(previewText, x + this.cardWidth / 2, y + 175);
        }

        // Cost Button
        const btnH = 40;
        const btnY = y + this.cardHeight - 60;
        const btnW = this.cardWidth - 40;
        const btnX = x + 20;

        if (isMaxed) {
            ctx.fillStyle = '#444';
            ctx.beginPath(); ctx.roundRect(btnX, btnY, btnW, btnH, 8); ctx.fill();
            ctx.fillStyle = '#888';
            ctx.font = 'bold 16px "Inter", sans-serif';
            ctx.fillText("MAXED", btnX + btnW / 2, btnY + 26);
        } else {
            ctx.fillStyle = canAfford ? (isSelected ? '#00e5ff' : '#0088aa') : '#442222';
            ctx.beginPath(); ctx.roundRect(btnX, btnY, btnW, btnH, 8); ctx.fill();

            ctx.fillStyle = canAfford ? '#000' : '#ff4444';
            ctx.font = 'bold 18px "Inter", sans-serif';
            ctx.fillText(`${cost} 💎`, btnX + btnW / 2, btnY + 26);
        }
    }

    private renderLevelDots(ctx: CanvasRenderingContext2D, level: number, cx: number, y: number): void {
        const size = 10;
        const gap = 6;
        const startX = cx - ((5 * size + 4 * gap) / 2) + size / 2;

        for (let i = 1; i <= 5; i++) {
            ctx.fillStyle = i <= level ? '#00e5ff' : '#333';
            ctx.beginPath();
            ctx.arc(startX + (i - 1) * (size + gap), y, size / 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}
