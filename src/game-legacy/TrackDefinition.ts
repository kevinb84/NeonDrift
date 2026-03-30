export type TrackSegmentType =
    | "straight"
    | "curve_left"
    | "curve_right"
    | "hairpin_left"
    | "hairpin_right"
    | "chicane"
    | "wide_curve";

export interface TrackSegment {
    type: TrackSegmentType;
    length: number;
    radius?: number; // For curves: tighter radius = sharper turn
    angle?: number;  // Degrees of turn
    width: number;   // Road width scaling (default 1.0)
    height?: number; // Elevation change (slope)
    curvatureBias?: number; // Adjustment for loop closure
    sprites?: Sprite[]; // Objects in this segment
}

export interface Sprite {
    type: 'BILLBOARD' | 'LIGHT_POST' | 'PALM_TREE' | 'COLUMN' | 'BUILDING_FAR' | 'BUILDING_NEAR';
    offset: number; // Lateral offset from center (-1 to 1, or wider for city)
    source?: string; // Optional texture path/color
}

export interface TrackPoint {
    x: number;          // World X
    y: number;          // World Y
    dx: number;         // Derivative X (Direction vector)
    dy: number;         // Derivative Y
    width: number;      // Track width at this point
    curvature: number;  // Inverse radius (1/r), 0 = straight, + = right, - = left
    distance: number;   // Accumulated distance from start (meters)
}

export interface TrackData {
    points: TrackPoint[];
    totalLength: number;
    startIndex: number; // For loop handling
}

// Example Technical Track Layout from User Request
export const TechnicalCircuit: TrackSegment[] = [
    { type: "straight", length: 300, width: 80 },

    { type: "curve_right", length: 200, radius: 120, angle: 60, width: 80 },

    { type: "chicane", length: 150, width: 70 },

    { type: "straight", length: 250, width: 75 },

    { type: "hairpin_left", length: 180, radius: 60, angle: 160, width: 70 },

    { type: "wide_curve", length: 250, radius: 200, angle: 90, width: 90 },

    { type: "straight", length: 300, width: 80 },
];
