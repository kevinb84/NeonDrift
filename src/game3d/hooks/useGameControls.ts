import { useEffect, useRef } from 'react';

export interface GameControls {
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
    nitro: boolean;
}

export function useGameControls() {
    const keys = useRef<GameControls>({
        left: false,
        right: false,
        up: false,
        down: false,
        nitro: false,
    });

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            switch (e.code) {
                case 'ArrowLeft':
                case 'KeyA':
                    keys.current.left = true;
                    break;
                case 'ArrowRight':
                case 'KeyD':
                    keys.current.right = true;
                    break;
                case 'ArrowUp':
                case 'KeyW':
                    keys.current.up = true;
                    break;
                case 'ArrowDown':
                case 'KeyS':
                    keys.current.down = true;
                    break;
                case 'ShiftLeft':
                case 'ShiftRight':
                case 'Space':
                    keys.current.nitro = true;
                    break;
            }
        };

        const onKeyUp = (e: KeyboardEvent) => {
            switch (e.code) {
                case 'ArrowLeft':
                case 'KeyA':
                    keys.current.left = false;
                    break;
                case 'ArrowRight':
                case 'KeyD':
                    keys.current.right = false;
                    break;
                case 'ArrowUp':
                case 'KeyW':
                    keys.current.up = false;
                    break;
                case 'ArrowDown':
                case 'KeyS':
                    keys.current.down = false;
                    break;
                case 'ShiftLeft':
                case 'ShiftRight':
                case 'Space':
                    keys.current.nitro = false;
                    break;
            }
        };

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
        };
    }, []);

    return keys;
}
