// ============================================================
// InputManager — Handles keyboard and mobile touch input
// ============================================================

import { InputState } from './types';
import { TOUCH_BUTTON_SIZE, TOUCH_BUTTON_MARGIN } from './constants';

export class InputManager {
    private keys: Record<string, boolean> = {};
    private touchState: InputState = { left: false, right: false, up: false, down: false, nitro: false, enter: false, pause: false };
    private forceTouch: boolean = false;
    public prevLeft: boolean = false;
    public prevRight: boolean = false;
    public prevUp: boolean = false;
    public prevDown: boolean = false;
    public prevEnter: boolean = false;
    public prevPause: boolean = false;
    private touchIds: Map<number, string> = new Map();
    private canvas: HTMLCanvasElement | null = null;

    // Mouse State
    private mouseX: number = 0;
    private mouseY: number = 0;
    private mouseClick: boolean = false; // Latched click for current frame

    /** Bind event listeners */
    init(canvas: HTMLCanvasElement): void {
        this.canvas = canvas;

        // Keyboard
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);

        // Touch
        canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });
        canvas.addEventListener('touchmove', this.onTouchMove, { passive: false });
        canvas.addEventListener('touchend', this.onTouchEnd);
        canvas.addEventListener('touchcancel', this.onTouchEnd);

        // Mouse
        canvas.addEventListener('mousemove', this.onMouseMove);
        canvas.addEventListener('mousedown', this.onMouseDown);
        canvas.addEventListener('mouseup', this.onMouseUp);
    }

    /** Remove event listeners */
    destroy(): void {
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup', this.onKeyUp);

        if (this.canvas) {
            this.canvas.removeEventListener('touchstart', this.onTouchStart);
            this.canvas.removeEventListener('touchmove', this.onTouchMove);
            this.canvas.removeEventListener('touchend', this.onTouchEnd);
            this.canvas.removeEventListener('touchcancel', this.onTouchEnd);

            this.canvas.removeEventListener('mousemove', this.onMouseMove);
            this.canvas.removeEventListener('mousedown', this.onMouseDown);
            this.canvas.removeEventListener('mouseup', this.onMouseUp);
        }
    }

    /** Get current combined input state */
    getState(): InputState {
        return {
            left: this.keys['ArrowLeft'] || this.keys['KeyA'] || this.touchState.left,
            right: this.keys['ArrowRight'] || this.keys['KeyD'] || this.touchState.right,
            up: this.keys['ArrowUp'] || this.keys['KeyW'] || this.touchState.up,
            down: this.keys['ArrowDown'] || this.keys['KeyS'] || this.touchState.down,
            nitro: this.keys['Space'] || this.keys['ShiftLeft'] || this.touchState.nitro,
            enter: this.keys['Enter'] || this.keys['NumpadEnter'] || this.touchState.enter,
            pause: this.touchState.pause, // Pause only via touch (or ESC handled separately)
            forceTouch: this.forceTouch,
            keys: this.keys,
            mouse: { x: this.mouseX, y: this.mouseY, click: this.mouseClick }
        };
    }

    /** Update previous state for edge detection. Call at end of frame. */
    update(): void {
        const state = this.getState();
        this.prevLeft = state.left;
        this.prevRight = state.right;
        this.prevUp = state.up;
        this.prevDown = state.down;
        this.prevEnter = state.enter || false;
        this.prevPause = state.pause || false;

        // Reset latched click
        this.mouseClick = false;
    }

    /** Check if this is likely a touch device or forced */
    isTouchDevice(): boolean {
        return this.forceTouch || 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }

    /** Get touch button rects for rendering */
    getTouchButtonRects(canvasWidth: number, canvasHeight: number) {
        const size = TOUCH_BUTTON_SIZE;
        const margin = TOUCH_BUTTON_MARGIN;
        const y = canvasHeight - size - margin;

        return {
            left: { x: margin, y, w: size, h: size },
            right: { x: margin + size + margin, y, w: size, h: size },
            nitro: { x: canvasWidth - size - margin, y, w: size, h: size },
            pause: { x: canvasWidth - 50, y: 20, w: 30, h: 30 } // Top right
        };
    }

    // --- Private handlers ---

    private onKeyDown = (e: KeyboardEvent): void => {
        this.keys[e.code] = true;

        // Toggle force touch on 'T'
        if (e.code === 'KeyT') {
            this.forceTouch = !this.forceTouch;
        }

        // Prevent page scrolling with arrow keys
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Tab'].includes(e.code)) {
            e.preventDefault();
        }
    };

    private onKeyUp = (e: KeyboardEvent): void => {
        this.keys[e.code] = false;
    };

    private onMouseUp = (_: MouseEvent): void => {
        // e.preventDefault(); 
    };

    private onMouseDown = (e: MouseEvent): void => {
        // e.preventDefault();
        this.updateMousePos(e);
        this.mouseClick = true;
    };

    private onMouseMove = (e: MouseEvent): void => {
        // e.preventDefault();
        this.updateMousePos(e);
    };

    private updateMousePos(e: MouseEvent): void {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        this.mouseX = (e.clientX - rect.left) * (this.canvas.width / rect.width);
        this.mouseY = (e.clientY - rect.top) * (this.canvas.height / rect.height);
    }

    private onTouchStart = (e: TouchEvent): void => {
        e.preventDefault();
        this.processTouches(e.changedTouches, true);
    };

    private onTouchMove = (e: TouchEvent): void => {
        e.preventDefault();
        // Re-evaluate all active touches
        this.touchState = { left: false, right: false, up: false, down: false, nitro: false, pause: false };
        this.touchIds.clear();
        this.processTouches(e.touches, true);
    };

    private onTouchEnd = (e: TouchEvent): void => {
        for (let i = 0; i < e.changedTouches.length; i++) {
            const id = e.changedTouches[i].identifier;
            const action = this.touchIds.get(id);
            if (action) {
                this.touchState[action as Exclude<keyof InputState, 'keys' | 'enter' | 'mouse'>] = false;
                this.touchIds.delete(id);
            }
        }
    };

    private processTouches(touches: TouchList, active: boolean): void {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        const buttons = this.getTouchButtonRects(this.canvas.width, this.canvas.height);

        // Scale touch coordinates to canvas coordinates
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        for (let i = 0; i < touches.length; i++) {
            const touch = touches[i];
            const tx = (touch.clientX - rect.left) * scaleX;
            const ty = (touch.clientY - rect.top) * scaleY;

            if (this.hitTest(tx, ty, buttons.left)) {
                this.touchState.left = active;
                this.touchIds.set(touch.identifier, 'left');
            } else if (this.hitTest(tx, ty, buttons.right)) {
                this.touchState.right = active;
                this.touchIds.set(touch.identifier, 'right');
            } else if (this.hitTest(tx, ty, buttons.nitro)) {
                this.touchState.nitro = active;
                this.touchIds.set(touch.identifier, 'nitro');
            } else if (this.hitTest(tx, ty, buttons.pause)) {
                this.touchState.pause = active;
                this.touchIds.set(touch.identifier, 'pause');
            }
        }
    }

    private hitTest(x: number, y: number, rect: { x: number; y: number; w: number; h: number }): boolean {
        return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
    }
}
