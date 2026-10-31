import { Vector3 } from 'three';

export const CINEMATIC_DURATION = 6.4;

// A single unbroken, fixed-lens dolly. The viewing direction stays on the same
// ray so the stage grows without orbiting, tilting, or sliding across the frame.
const DOLLY_START = .13;
const HOME_POSITION = new Vector3(6.5, 4.7, 11);
const HOME_TARGET = new Vector3(0, 1.6, 0);
const FAR_POSITION = new Vector3(12.025, 7.335, 20.35);
const ease = value => value * value * value * (value * (value * 6 - 15) + 10);

export function createCinematicCamera() {
  return {
    // Supply reusable Vector3 instances in out to avoid allocations in the RAF.
    sample(progress, out) {
      const pose = out ?? {};
      pose.position ??= new Vector3();
      pose.target ??= new Vector3();
      const p = typeof progress === 'number' && !Number.isNaN(progress)
        ? Math.max(0, Math.min(1, progress)) : 0;
      const linear = Math.max(0, (p - DOLLY_START) / (1 - DOLLY_START));
      const travel = ease(linear);
      // Exact endpoints make handing the camera back to OrbitControls seamless.
      if (p <= DOLLY_START) pose.position.copy(FAR_POSITION);
      else if (p === 1) pose.position.copy(HOME_POSITION);
      else pose.position.lerpVectors(FAR_POSITION, HOME_POSITION, travel);
      pose.target.copy(HOME_TARGET);
      pose.fov = 34;
      pose.roll = 0;
      return pose;
    },
  };
}
