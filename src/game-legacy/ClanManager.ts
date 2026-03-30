
import { NeonBalanceManager } from './NeonBalanceManager';

export interface Clan {
    clanId: string;
    name: string;
    tag: string;
    leaderId: string;
    members: string[];
    clanNeonVault: number;
    clanRankPoints: number;
    createdAt: number;
}

export interface ClanInvite {
    clanId: string;
    invitedPlayerId: string;
    invitedBy: string;
    createdAt: number;
}

const CLAN_STORAGE_KEY = 'neon_clans';
const CLAN_CREATE_COST = 500;
const MAX_MEMBERS = 20;

export class ClanManager {
    private clans: Clan[] = [];
    private balanceManager: NeonBalanceManager;

    constructor(balanceManager: NeonBalanceManager) {
        this.balanceManager = balanceManager;
        this.loadClans();
    }

    private loadClans() {
        try {
            const data = localStorage.getItem(CLAN_STORAGE_KEY);
            if (data) {
                this.clans = JSON.parse(data);
            }
        } catch (e) {
            console.error("Failed to load clans", e);
            this.clans = [];
        }
    }

    private saveClans() {
        localStorage.setItem(CLAN_STORAGE_KEY, JSON.stringify(this.clans));
    }

    public createClan(name: string, tag: string, leaderId: string): { success: boolean; message: string; clan?: Clan } {
        // Validation
        if (!name || name.length < 3) return { success: false, message: "Name too short (min 3 chars)" };
        if (!tag || tag.length < 2 || tag.length > 4) return { success: false, message: "Tag must be 2-4 chars" };
        if (this.clans.some(c => c.name.toLowerCase() === name.toLowerCase())) return { success: false, message: "Clan name taken" };
        if (this.clans.some(c => c.tag.toUpperCase() === tag.toUpperCase())) return { success: false, message: "Clan tag taken" };
        if (this.getPlayerClan(leaderId)) return { success: false, message: "You are already in a clan" };

        // Cost
        if (!this.balanceManager.canAfford(CLAN_CREATE_COST)) {
            return { success: false, message: `Insufficient Neon. Cost: ${CLAN_CREATE_COST}` };
        }

        // Execute
        this.balanceManager.subtract(CLAN_CREATE_COST);

        const newClan: Clan = {
            clanId: this.generateId(),
            name,
            tag: tag.toUpperCase(),
            leaderId,
            members: [leaderId],
            clanNeonVault: 0,
            clanRankPoints: 0,
            createdAt: Date.now()
        };

        this.clans.push(newClan);
        this.saveClans();

        return { success: true, message: "Clan created successfully!", clan: newClan };
    }

    public getPlayerClan(playerId: string): Clan | undefined {
        return this.clans.find(c => c.members.includes(playerId));
    }

    public getClan(clanId: string): Clan | undefined {
        return this.clans.find(c => c.clanId === clanId);
    }

    public getAllClans(): Clan[] {
        return this.clans;
    }

    public joinClan(clanId: string, playerId: string): { success: boolean; message: string } {
        const clan = this.getClan(clanId);
        if (!clan) return { success: false, message: "Clan not found" };

        if (clan.members.length >= MAX_MEMBERS) return { success: false, message: "Clan is full" };
        if (this.getPlayerClan(playerId)) return { success: false, message: "You are already in a clan" };
        if (clan.members.includes(playerId)) return { success: false, message: "Already a member" };

        clan.members.push(playerId);
        this.saveClans();
        return { success: true, message: `Joined ${clan.name}!` };
    }

    public leaveClan(playerId: string): { success: boolean; message: string } {
        const clan = this.getPlayerClan(playerId);
        if (!clan) return { success: false, message: "Not in a clan" };

        if (clan.leaderId === playerId) {
            // If leader leaves, disband or transfer? For now, disband if last member, else transfer to next
            if (clan.members.length === 1) {
                this.clans = this.clans.filter(c => c.clanId !== clan.clanId);
                this.saveClans();
                return { success: true, message: "Clan disbanded" };
            } else {
                // Pass leadership to next member
                clan.leaderId = clan.members[1];
            }
        }

        clan.members = clan.members.filter(m => m !== playerId);
        this.saveClans();
        return { success: true, message: "Left clan" };
    }

    public donate(playerId: string, amount: number): { success: boolean; message: string } {
        const clan = this.getPlayerClan(playerId);
        if (!clan) return { success: false, message: "Not in a clan" };

        if (amount <= 0) return { success: false, message: "Invalid amount" };
        if (!this.balanceManager.canAfford(amount)) return { success: false, message: "Insufficient funds" };

        this.balanceManager.subtract(amount);
        clan.clanNeonVault += amount;
        this.saveClans();

        return { success: true, message: `Donated ${amount} Neon to vault` };
    }

    public addRankPoints(clanId: string, amount: number) {
        const clan = this.getClan(clanId);
        if (clan) {
            clan.clanRankPoints += amount;
            this.saveClans();
        }
    }

    private generateId(): string {
        return 'clan_' + Math.random().toString(36).substr(2, 9);
    }
}
