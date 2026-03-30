import type { TrackConfig } from '../menu/useGameFlow';

/** Calculates the horizontal X offset for a given Z world position to simulate track curvature */
export function getCurveOffset(worldZ: number, scrollDistance: number, track: TrackConfig | undefined) {
    if (!track?.curvature) return 0;
    // The curve is based on the absolute track distance we've driven, minus the current Z camera distance
    const trackPos = scrollDistance - worldZ;
    return Math.sin(trackPos * track.curvature.frequency) * track.curvature.amplitude;
}
