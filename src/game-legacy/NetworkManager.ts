
export interface InputPacket {
    t: number;      // Timestamp (for reconciliation)
    i: number;      // Sequence ID (to detect packet loss)
    data: {
        th: number; // Throttle
        b: number;  // Brake
        s: number;  // Steering
        n: boolean; // Nitro
    }
}

export interface PlayerState {
    id: string;
    x: number;      // X Position (Lane)
    z: number;      // Z Position (Distance)
    s: number;      // Speed
    l: number;      // Lap
    r: number;      // Rotation (visual)
}

export interface StatePacket {
    t: number;      // Server Timestamp
    p: PlayerState[];
}

export class NetworkManager {
    private ws: WebSocket | null = null;
    private url: string = 'ws://localhost:8080'; // Default, needs env or config
    private connected: boolean = false;


    // Callbacks
    public onStateUpdate: (state: StatePacket) => void = () => { };
    public onConnect: () => void = () => { };
    public onDisconnect: () => void = () => { };

    constructor() { }

    public connect(url?: string): void {
        if (this.ws) {
            this.ws.close();
        }

        if (url) this.url = url;

        console.log(`Connecting to ${this.url}...`);

        try {
            this.ws = new WebSocket(this.url);

            this.ws.onopen = () => {
                console.log('Connected to Game Server');
                this.connected = true;
                this.onConnect();
            };

            this.ws.onclose = () => {
                console.log('Disconnected from Game Server');
                this.connected = false;
                this.onDisconnect();
            };

            this.ws.onerror = (err) => {
                console.error('WebSocket Error:', err);
            };

            this.ws.onmessage = (event) => {
                this.handleMessage(event.data);
            };
        } catch (e) {
            console.error('Connection failed:', e);
        }
    }

    public disconnect(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    public joinRoom(roomId: string, playerId: string): void {
        if (!this.connected) return;
        this.send({
            type: 'JOIN',
            roomId,
            playerId
        });
    }

    public sendInput(input: InputPacket): void {
        if (!this.connected) return;
        // Optimization: Use binary arrays in real prod, JSON for prototype
        this.send({
            type: 'INPUT',
            payload: input
        });
    }

    private send(msg: any): void {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
        }
    }

    private handleMessage(data: any): void {
        try {
            const msg = JSON.parse(data);
            switch (msg.type) {
                case 'STATE':
                    if (this.onStateUpdate) {
                        this.onStateUpdate(msg.payload as StatePacket);
                    }
                    break;
                case 'JOINED':
                    console.log(`Joined room: ${msg.roomId}`);
                    break;
                case 'ERROR':
                    console.error('Server Error:', msg.message);
                    break;
            }
        } catch (e) {
            console.error('Failed to parse message:', e);
        }
    }

    public isConnected(): boolean {
        return this.connected;
    }

    public getLatency(): number {
        // Todo: Implement ping/pong
        return 0;
    }
}
