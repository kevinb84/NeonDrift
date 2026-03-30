import { PvPStakingManager } from './PvPStakingManager';


export class PvPSelectionScreen {
    private canvas: HTMLCanvasElement | null = null;
    private manager: PvPStakingManager;


    // State
    private mode: 'CREATE' | 'JOIN' = 'CREATE';
    private selectStakeIndex: number = 0;
    private stakes = [10, 25, 50, 100, 250, 500];
    private selectedDifficulty: string = 'HARD';
    private isRanked: boolean = false;

    // UI Rects
    private createTabRect = { x: 0, y: 0, w: 0, h: 0 };
    private joinTabRect = { x: 0, y: 0, w: 0, h: 0 };
    private stakeRects: Array<{ x: number, y: number, w: number, h: number, val: number }> = [];
    private createBtnRect = { x: 0, y: 0, w: 0, h: 0 };
    private joinBtnRects: Array<{ x: number, y: number, w: number, h: number, roomId: string }> = [];
    private backBtnRect = { x: 0, y: 0, w: 0, h: 0 };

    private mouseX: number = 0;
    private mouseY: number = 0;
    private intervalId: number | null = null;

    private boundMouseMove: (e: MouseEvent) => void = () => { };
    private boundClick: (e: MouseEvent) => void = () => { };

    public onBack: () => void = () => { };
    public onRoomReady: () => void = () => { };

    constructor(manager: PvPStakingManager) {
        this.manager = manager;
    }

    init(canvas: HTMLCanvasElement): void {
        this.canvas = canvas;

        this.boundMouseMove = (e: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            this.mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
            this.mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
        };

        this.boundClick = () => {
            this.handleClick();
        };

        canvas.addEventListener('mousemove', this.boundMouseMove);
        canvas.addEventListener('click', this.boundClick);
    }

    destroy(): void {
        if (this.intervalId !== null) {
            window.clearInterval(this.intervalId);
            this.intervalId = null;
        }
        if (this.canvas) {
            this.canvas.removeEventListener('mousemove', this.boundMouseMove);
            this.canvas.removeEventListener('click', this.boundClick);
        }
    }

    handleInput(input: any): void {
        // Simple back navigation
        if (input.keys && input.keys['Escape']) {
            this.onBack();
        }
    }

    render(ctx: CanvasRenderingContext2D, w: number, h: number): void {
        // BG
        ctx.fillStyle = '#1a0a2e';
        ctx.fillRect(0, 0, w, h);

        // Header
        ctx.font = 'bold 36px "Inter"';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText("⚔️ PvP ARENA", w / 2, 60);

        // Sidebar / Tabs
        const tabW = 200;
        const tabH = 50;
        this.createTabRect = { x: w * 0.1, y: 100, w: tabW, h: tabH };
        this.joinTabRect = { x: w * 0.1 + tabW + 20, y: 100, w: tabW, h: tabH };

        this.drawTab(ctx, this.createTabRect, "CREATE ROOM", this.mode === 'CREATE');
        this.drawTab(ctx, this.joinTabRect, "LOBBY", this.mode === 'JOIN');

        // Content Area
        const contentY = 170;
        const contentH = h - contentY - 100;

        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(w * 0.05, contentY, w * 0.9, contentH);

        if (this.mode === 'CREATE') {
            this.renderCreateInternal(ctx, w, h, contentY);
        } else {
            this.renderJoinInternal(ctx, w, h, contentY);
        }

        // Back Btn
        this.backBtnRect = { x: 20, y: 20, w: 100, h: 40 };
        ctx.fillStyle = '#333';
        ctx.fillRect(this.backBtnRect.x, this.backBtnRect.y, this.backBtnRect.w, this.backBtnRect.h);
        ctx.fillStyle = '#fff';
        ctx.font = '16px "Inter"';
        ctx.fillText("← BACK", 70, 45);
    }

    private drawTab(ctx: CanvasRenderingContext2D, r: any, text: string, active: boolean) {
        ctx.fillStyle = active ? '#a855f7' : '#333';
        ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.fillStyle = active ? '#fff' : '#888';
        ctx.font = 'bold 16px "Inter"';
        ctx.fillText(text, r.x + r.w / 2, r.y + 30);
    }

    private renderCreateInternal(ctx: CanvasRenderingContext2D, w: number, _h: number, startY: number) {
        this.stakeRects = [];
        let cy = startY + 50;

        ctx.fillStyle = '#fff';
        ctx.font = '20px "Inter"';
        ctx.fillText("SELECT STAKE (NEON)", w / 2, cy);

        cy += 40;
        const stakeW = 100;
        const gap = 20;
        const totalW = (stakeW + gap) * this.stakes.length - gap;
        let sx = (w - totalW) / 2;

        this.stakes.forEach((s, i) => {
            const r = { x: sx, y: cy, w: stakeW, h: 60 };
            this.stakeRects.push({ ...r, val: s });

            ctx.fillStyle = this.selectStakeIndex === i ? '#00e5ff' : '#444';
            ctx.fillRect(r.x, r.y, r.w, r.h);

            ctx.fillStyle = this.selectStakeIndex === i ? '#000' : '#fff';
            ctx.fillText(s.toString(), r.x + stakeW / 2, r.y + 35);

            sx += stakeW + gap;
        });

        // Difficulty & Ranked Toggle (simplified)
        // ... (We just default to Hard/Ranked for now to save time, or cycle click)

        // Create Button
        cy += 200;
        const btnW = 300;
        const btnH = 60;
        this.createBtnRect = { x: (w - btnW) / 2, y: cy, w: btnW, h: btnH };

        ctx.fillStyle = '#00e5ff';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00e5ff';
        ctx.fillRect(this.createBtnRect.x, this.createBtnRect.y, btnW, btnH);
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#000';
        ctx.font = 'bold 24px "Inter"';
        ctx.fillText("CREATE ROOM", w / 2, cy + 38);
    }

    private renderJoinInternal(ctx: CanvasRenderingContext2D, w: number, _h: number, startY: number) {
        this.joinBtnRects = [];
        const rooms = this.manager.getAvailableRooms();

        let ry = startY + 20;

        if (rooms.length === 0) {
            ctx.fillStyle = '#888';
            ctx.fillText("No rooms found. Create one!", w / 2, ry + 50);
            return;
        }

        rooms.forEach((room) => {
            const rowH = 60;
            const r = { x: w * 0.1, y: ry, w: w * 0.8, h: rowH };

            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            ctx.fillRect(r.x, r.y, r.w, r.h);

            ctx.fillStyle = '#fff';
            ctx.textAlign = 'left';
            ctx.fillText(`Host: ${room.hostId} | Stake: ${room.stake} | ${room.difficulty}`, r.x + 20, r.y + 35);

            // Join Btn
            const btnW = 100;
            const btnr = { x: r.x + r.w - 120, y: r.y + 10, w: btnW, h: 40 };
            this.joinBtnRects.push({ ...btnr, roomId: room.roomId });

            ctx.fillStyle = '#00ff00';
            ctx.fillRect(btnr.x, btnr.y, btnr.w, btnr.h);

            ctx.textAlign = 'center';
            ctx.fillStyle = '#000';
            ctx.fillText("JOIN", btnr.x + btnW / 2, btnr.y + 25);

            ry += rowH + 10;
        });
        ctx.textAlign = 'center';
    }

    private handleClick() {
        if (this.isInRect(this.createTabRect)) this.mode = 'CREATE';
        if (this.isInRect(this.joinTabRect)) this.mode = 'JOIN';
        if (this.isInRect(this.backBtnRect)) this.onBack();

        if (this.mode === 'CREATE') {
            this.stakeRects.forEach((r, i) => {
                if (this.isInRect(r)) this.selectStakeIndex = i;
            });

            if (this.isInRect(this.createBtnRect)) {
                const stake = this.stakes[this.selectStakeIndex];
                if (this.manager.createRoom(stake, this.selectedDifficulty, this.isRanked)) {
                    // Start waiting... for sim we just auto-ready
                    this.manager.simulateOpponentJoin();
                    this.waitAndStart();
                } else {
                    console.warn("Insufficient funds!");
                }
            }
        } else {
            this.joinBtnRects.forEach(r => {
                if (this.isInRect(r)) {
                    if (this.manager.joinRoom(r.roomId)) {
                        this.onRoomReady();
                    } else {
                        alert("Cannot join (Funds?)");
                    }
                }
            });
        }
    }

    private waitAndStart() {
        // Poll for ready
        this.intervalId = window.setInterval(() => {
            const room = this.manager.getCurrentRoom();
            if (room && room.status === 'ready') {
                if (this.intervalId) window.clearInterval(this.intervalId);
                this.onRoomReady();
            }
        }, 500);
    }

    private isInRect(r: any) {
        return this.mouseX >= r.x && this.mouseX <= r.x + r.w &&
            this.mouseY >= r.y && this.mouseY <= r.y + r.h;
    }
}
