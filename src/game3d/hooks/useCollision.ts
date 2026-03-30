import { useCallback, useRef } from 'react';

const COLLISION_COOLDOWN = 0.8; // seconds between collisions
const SPEED_PENALTY = 0.4;     // multiply speed by this on collision

interface CarBox {
    x: number;
    z: number;
    halfW: number;
    halfD: number;
}

/** Simple AABB collision detection between player and AI cars */
export function useCollision() {
    const cooldownRef = useRef(0);

    const checkCollision = useCallback(
        (
            playerX: number,
            playerZ: number,
            aiPositions: { x: number; z: number }[],
            dt: number,
        ): { hit: boolean; aiIndex: number; dx: number; dz: number } | null => {
            if (cooldownRef.current > 0) {
                cooldownRef.current -= dt;
                return null;
            }

            const player: CarBox = {
                x: playerX,
                z: playerZ,
                halfW: 1.0,   // car is ~2 units wide
                halfD: 2.0,   // car is ~4 units deep
            };

            for (let i = 0; i < aiPositions.length; i++) {
                const ai = aiPositions[i];
                const aiBox: CarBox = {
                    x: ai.x,
                    z: ai.z,
                    halfW: 0.9,
                    halfD: 1.75,
                };

                // AABB overlap test
                const dx = player.x - aiBox.x;
                const dz = player.z - aiBox.z;

                const overlapX = Math.abs(dx) < (player.halfW + aiBox.halfW);
                const overlapZ = Math.abs(dz) < (player.halfD + aiBox.halfD);

                if (overlapX && overlapZ) {
                    cooldownRef.current = COLLISION_COOLDOWN;
                    return { hit: true, aiIndex: i, dx, dz };
                }
            }

            return null;
        },
        [],
    );

    return { checkCollision, SPEED_PENALTY };
}
