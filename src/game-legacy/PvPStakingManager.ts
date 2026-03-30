import { NeonBalanceManager } from './NeonBalanceManager';
import { PlatformReserveManager } from './PlatformReserveManager';

export interface StakingRoom {
    roomId: string;
    hostId: string; // 'player' for local user, 'opponent' for AI/remote
    opponentId?: string;
    stake: number;
    difficulty: string;
    isRanked: boolean;
    status: 'waiting' | 'ready' | 'racing' | 'finished' | 'cancelled';
    winnerId?: string;
    createdAt: number;
}

export class PvPStakingManager {
    private rooms: StakingRoom[] = [];
    private currentRoom: StakingRoom | null = null;
    private balanceManager: NeonBalanceManager;
    private reserveManager: PlatformReserveManager;

    private readonly ALLOWED_STAKES = [10, 25, 50, 100, 250, 500];
    private readonly PLATFORM_FEE = 0.05;

    constructor(balance: NeonBalanceManager, reserve: PlatformReserveManager) {
        this.balanceManager = balance;
        this.reserveManager = reserve;
    }

    // --- Room Management ---

    createRoom(stake: number, difficulty: string, isRanked: boolean): boolean {
        if (!this.ALLOWED_STAKES.includes(stake)) return false;
        if (!this.balanceManager.canAfford(stake)) return false;

        // Deduct stake from host
        this.balanceManager.subtract(stake);

        const room: StakingRoom = {
            roomId: Math.random().toString(36).substring(2, 9),
            hostId: 'player',
            stake,
            difficulty,
            isRanked,
            status: 'waiting',
            createdAt: Date.now()
        };

        this.rooms.push(room);
        this.currentRoom = room;
        return true;
    }

    joinRoom(roomId: string): boolean {
        const room = this.rooms.find(r => r.roomId === roomId);
        if (!room || room.status !== 'waiting') return false;

        if (!this.balanceManager.canAfford(room.stake)) return false;

        // Deduct stake
        this.balanceManager.subtract(room.stake);

        room.opponentId = 'player'; // If we are joining, we are the 'player' relative to ourselves? 
        // Wait, if we join, we become the opponent? 
        // Local logic: If I join, I am the second player.
        room.status = 'ready';
        this.currentRoom = room;
        return true;
    }

    // Simulate opponent joining for single-player demo
    simulateOpponentJoin(): void {
        if (!this.currentRoom || this.currentRoom.status !== 'waiting') return;

        setTimeout(() => {
            if (this.currentRoom && this.currentRoom.status === 'waiting') {
                this.currentRoom.opponentId = 'ai-opponent';
                this.currentRoom.status = 'ready';
                // Trigger race start sequence elsewhere
            }
        }, 2000); // 2s delay
    }

    // --- Race Logic ---

    startRace(): void {
        if (this.currentRoom && this.currentRoom.status === 'ready') {
            this.currentRoom.status = 'racing';
        }
    }

    resolveRace(didWin: boolean): { prize: number, fee: number } {
        if (!this.currentRoom || this.currentRoom.status !== 'racing') return { prize: 0, fee: 0 };

        const totalPool = this.currentRoom.stake * 2;
        const fee = Math.floor(totalPool * this.PLATFORM_FEE);
        const prize = totalPool - fee;

        this.reserveManager.addFee(fee);

        if (didWin) {
            this.currentRoom.winnerId = 'player';
            this.balanceManager.add(prize);
        } else {
            this.currentRoom.winnerId = 'opponent';
        }

        this.currentRoom.status = 'finished';

        // Cleanup logic could go here
        return { prize, fee };
    }

    cancelRoom(): void {
        if (!this.currentRoom) return;

        // Refund if race hasn't finished
        if (this.currentRoom.status !== 'finished') {
            this.balanceManager.add(this.currentRoom.stake);
        }

        this.currentRoom.status = 'cancelled';
        this.currentRoom = null;
    }

    getCurrentRoom(): StakingRoom | null {
        return this.currentRoom;
    }

    // For lobby list (mock data for now + local room)
    getAvailableRooms(): StakingRoom[] {
        // Return local rooms + some mock text rooms
        return this.rooms.filter(r => r.status === 'waiting');
    }
}
