// ============================================================
// Game Constants — All tuning values for the racing game
// ============================================================

// === Road Geometry ===
// === Road Geometry ===
export const SEGMENT_LENGTH = 30;      // Shorter segments = more detail, faster feel
export const ROAD_WIDTH = 10000;        // Wider road for 4 lanes
export const LANE_COUNT = 4;
export const DRAW_DISTANCE = 300;       // Increase draw distance for depth
export const TOTAL_SEGMENTS = 300;      // Track length in segments (one lap)
export const TRACK_LENGTH = TOTAL_SEGMENTS * SEGMENT_LENGTH;

// === Camera ===
export const CAMERA_HEIGHT = 1000;
export const CAMERA_DEPTH = 1 / Math.tan((70 / 2) * Math.PI / 180); // FOV 70
export const CAMERA_OFFSET_Z = -5;

// === Player ===
export const PLAYER_MAX_SPEED = 400;    // Higher max speed for arcade feel
export const PLAYER_ACCEL = 180;        // Faster acceleration
export const PLAYER_BRAKE = 400;        // Strong braking
export const PLAYER_STEER_SPEED = 3.5;  // Responsive steering
export const PLAYER_OFF_ROAD_SLOW = 0.6;
export const PLAYER_COLLISION_SLOW = 0.3;
export const DRIFT_FACTOR = 0.015;
export const NITRO_SPEED_BOOST = 200;   // Bigger nitro boost
export const NITRO_ACCEL = 350;         // Faster nitro ramp
export const SPEED_MULTIPLIER = 2.5;    // Forward velocity multiplier — the arcade feel

// === AI Cars ===
export const AI_CAR_COUNT = 5;
export const AI_SPEED_MIN = 180;        // Faster AI
export const AI_SPEED_MAX = 350;
export const AI_WANDER_RATE = 0.002;
export const AI_SPACING = 50;

// === Car Dimensions (visual) ===
export const CAR_WIDTH = 0.3;
export const CAR_HEIGHT_RATIO = 0.6;

// === Starting Grid ===
// Grid positions: [row offset Z, lane X position]
// Row 1 (front): AI1, AI2
// Row 2 (middle): Player, AI3
// Row 3 (back): AI4, AI5
export const GRID_ROW_SPACING = SEGMENT_LENGTH * 4; // 400 units between rows
export const GRID_POSITIONS = {
    player: { row: 1, lane: 0 },       // Center of row 2
    ai: [
        { row: 0, lane: -0.5 },         // Row 1 left
        { row: 0, lane: 0.5 },          // Row 1 right
        { row: 1, lane: 0.5 },          // Row 2 right (beside player)
        { row: 2, lane: -0.5 },         // Row 3 left
        { row: 2, lane: 0.5 },          // Row 3 right
    ],
};

// === Colors ===
export const COLORS = {
    SKY_TOP: '#1a0a2e',
    SKY_BOTTOM: '#16213e',

    ROAD_LIGHT: '#1a1a2e', // Dark Asphalt
    ROAD_DARK: '#16162a',
    GRASS_LIGHT: '#050510', // City Floor (Dark)
    GRASS_DARK: '#000000',
    RUMBLE_LIGHT: '#00e5ff', // Neon Curb
    RUMBLE_DARK: '#ff0055',
    LANE_MARKER: '#ffffff',

    SIDEWALK_LIGHT: '#2a2a40',
    SIDEWALK_DARK: '#202030',

    BUILDINGS: ['#2a1a3e', '#1e3a5f', '#3a1a2e', '#1a2a4e', '#2e2a1a', '#1a3e2a'],

    AI_CARS: ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#e67e22', '#1abc9c', '#ecf0f1'],

    WATER: '#0a1a2a', // Dark "Void" or Water
    WATER_LIGHT: '#1a2a4a',

    FINISH_LINE: '#ffffff',
    FINISH_CHECKER: '#000000',
};

// === HUD ===
export const HUD_FONT = 'bold 24px "Inter", "Segoe UI", sans-serif';
export const HUD_FONT_LARGE = 'bold 48px "Inter", "Segoe UI", sans-serif';
export const HUD_FONT_SMALL = 'bold 16px "Inter", "Segoe UI", sans-serif';
export const HUD_COLOR = '#ffffff';
export const HUD_ACCENT = '#00e5ff';
export const HUD_WARNING = '#ff4444';

// === Touch Controls ===
export const TOUCH_BUTTON_SIZE = 60;
export const TOUCH_BUTTON_MARGIN = 20;
export const TOUCH_BUTTON_OPACITY = 0.4;

// === Physics (Rigid Body) ===
export const CAR_MASS = 1200;       // kg
export const CAR_INERTIA = 2500;    // kg*m^2 (Moment of Inertia)
export const CAR_WHEELBASE = 2.6;   // meters
export const CAR_FRONT_AXLE = 1.3;  // meters from Center of Gravity
export const CAR_REAR_AXLE = 1.3;   // meters from Center of Gravity
export const TIRE_GRIP_FRONT = 45000; // N/rad (Cornering Stiffness - Tuned for Drift)
export const TIRE_GRIP_REAR = 40000;  // N/rad (Lower rear = Oversteer)
export const BRAKE_FORCE = 20000;     // N
export const ENGINE_FORCE = 12000;    // N (Approx 0-100 in ~4s)
export const AIR_DENSITY = 1.225;     // kg/m^3
export const DRAG_AREA = 2.2;         // m^2
export const STEER_ANGLE_MAX = 0.6;   // Radians (~35 degrees)
