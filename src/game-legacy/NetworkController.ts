
import { Car } from './types';
import { NetworkManager, StatePacket, PlayerState } from './NetworkManager';
import { COLORS } from './constants';

export class NetworkController {
    cars: Car[] = [];
    private networkManager: NetworkManager;

    // Interpolation Buffer
    private stateBuffer: StatePacket[] = [];
    private INTERPOLATION_DELAY = 100; // ms

    constructor(networkManager: NetworkManager) {
        this.networkManager = networkManager;
        // Bind to network updates
        this.networkManager.onStateUpdate = (packet) => this.onServerUpdate(packet);
    }

    private onServerUpdate(packet: StatePacket) {
        // Add to buffer
        this.stateBuffer.push(packet);

        // Prune old packets (keep last 2 seconds max)
        if (this.stateBuffer.length > 20) {
            this.stateBuffer.shift();
        }

        // Manage Car Entities (Join/Leave)
        this.syncCarEntities(packet.p);
    }

    private syncCarEntities(players: PlayerState[]) {
        // Remove disconnected
        this.cars = this.cars.filter(c => players.some(p => p.id === c.id));

        // Add new
        players.forEach(p => {
            if (!this.cars.find(c => c.id === p.id)) {
                this.cars.push({
                    id: p.id,
                    x: p.x,
                    z: p.z,
                    speed: p.s,
                    maxSpeed: 0, // Not used for remote cars loop, but required by type
                    width: 0.25,
                    height: 0.15,
                    color: COLORS.AI_CARS[Math.floor(Math.random() * COLORS.AI_CARS.length)], // Random color for now
                    isPlayer: false,
                    lane: 0, // Visual only
                    targetLane: 0,
                    braking: false,
                    steerOffset: 0
                });
            }
        });
    }

    private trackLength: number = 30000; // Default, should be set

    setTrackLength(length: number): void {
        this.trackLength = length;
    }

    private lerp(a: number, b: number, t: number): number {
        return a + (b - a) * t;
    }

    /** Interpolate Z respecting track wrap-around */
    private lerpZ(z0: number, z1: number, t: number): number {
        const L = this.trackLength;
        let delta = z1 - z0;

        // If moved more than half track length, assume wrap
        if (delta > L / 2) delta -= L;
        else if (delta < -L / 2) delta += L;

        return (z0 + delta * t + L) % L;
    }

    update(_dt: number, _playerZ: number): void {
        const renderTime = Date.now() - this.INTERPOLATION_DELAY;

        // Find two packets surrounding renderTime
        let p0: StatePacket | null = null;
        let p1: StatePacket | null = null;

        for (let i = this.stateBuffer.length - 1; i >= 0; i--) {
            if (this.stateBuffer[i].t <= renderTime) {
                p0 = this.stateBuffer[i];
                p1 = this.stateBuffer[i + 1]; // Can be undefined
                break;
            }
        }

        if (p0 && p1) {
            // Interpolate
            const total = p1.t - p0.t;
            const elapsed = renderTime - p0.t;
            const t = Math.max(0, Math.min(1, elapsed / total)); // Clamp t

            this.cars.forEach(car => {
                const s0 = p0!.p.find(p => p.id === car.id);
                const s1 = p1!.p.find(p => p.id === car.id);

                if (s0 && s1) {
                    car.x = this.lerp(s0.x, s1.x, t);
                    car.z = this.lerpZ(s0.z, s1.z, t);
                    car.speed = this.lerp(s0.s, s1.s, t);

                    // Visuals
                    // car.steerOffset ... derive from x change?
                    const dx = s1.x - s0.x;
                    car.steerOffset = Math.sign(dx) * Math.min(Math.abs(dx * 5), 1);
                }
            });
        } else if (p0) {
            // Extrapolate or Snap (Snap for now)
            this.cars.forEach(car => {
                const s0 = p0!.p.find(p => p.id === car.id);
                if (s0) {
                    car.x = s0.x;
                    car.z = s0.z;
                    car.speed = s0.s;
                }
            });
        }
    }

    getPlayerPosition(playerZ: number): number {
        let pos = 1;
        for (const car of this.cars) {
            if (car.z > playerZ) pos++;
        }
        return pos;
    }
}
