// Night Post — all tuning and palette in one place.
// Field: one walled courtyard, 1280x720, fixed 60 Hz step.

export const FIELD_W = 1280;
export const FIELD_H = 720;

export const PLAYER_RADIUS = 14;
export const PLAYER_WALK = 170;
export const PLAYER_SNEAK = 85;
export const PLAYER_PICKUP = 24;

export const NOISE_RUN = 100;
export const NOISE_SNEAK = 30;
export const NOISE_INTERVAL = 0.5;

export const GUARD_RADIUS = 14;
export const VISION_RANGE = 230;
export const VISION_HALF_ANGLE = 0.6;
export const CATCH_RADIUS = 26;
export const BUSH_SPOT = 55;
export const WAYPOINT_PAUSE = 0.8;
export const SCAN_SPEED = 0.8;
export const SCAN_AMPLITUDE = 0.9;
export const LOSE_SIGHT = 3;
export const INVESTIGATE_TIME = 4;
export const CHASE_SPEED = 150;
export const INVESTIGATE_SPEED_MUL = 1.25;

export const SUSPICION_CLOSE_RATE = 1.4;
export const SUSPICION_FAR_RATE = 0.35;
export const SUSPICION_CLOSE_DIST = 120;
export const SUSPICION_LAMP_MUL = 1.6;
export const SUSPICION_RUN_MUL = 1.5;
export const SUSPICION_BUSH_MUL = 0.5;
export const SUSPICION_DECAY = 0.5;
export const SUSPICION_INVESTIGATE = 0.45;
export const SUSPICION_CHASE = 1.0;

export const PALETTE = {
  floor: '#0b1220',
  floorLine: '#111a2e',
  wall: '#2b3350',
  wallEdge: '#4a5878',
  crate: '#4a3524',
  crateEdge: '#7a5a38',
  bush: '#14301c',
  bushLeaf: '#1f7a37',
  lampGlow: 'rgba(250, 204, 21, 0.16)',
  lampPost: '#facc15',
  letter: '#fde68a',
  letterGlow: 'rgba(253, 230, 138, 0.5)',
  exit: '#22c55e',
  exitGlow: 'rgba(34, 197, 94, 0.35)',
  player: '#e2e8f0',
  playerAccent: '#38bdf8',
  guard: '#f87171',
  coneCalm: 'rgba(250, 204, 21, 0.18)',
  coneAlert: 'rgba(249, 115, 22, 0.30)',
  coneChase: 'rgba(239, 68, 68, 0.38)',
  hud: '#e2e8f0',
  hudDim: '#94a3b8',
  titleBg: 'rgba(2, 6, 23, 0.72)',
};
