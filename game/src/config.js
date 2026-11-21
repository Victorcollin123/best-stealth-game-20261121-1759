// Night Post — all tuning in one place.
// Field: a walled courtyard at night, 1280x720 logical pixels, fixed 60 Hz step.

export const FIELD = { w: 1280, h: 720 };

export const PLAYER = {
  radius: 14,
  walk: 170, // px/s
  sneak: 85, // px/s
  runNoiseRadius: 100,
  sneakNoiseRadius: 30,
  noiseInterval: 0.5, // s between footstep noises while moving
};

export const GUARD = {
  radius: 14,
  visionRange: 230,
  halfAngle: 0.6, // radians either side of facing
  catchRadius: 26,
  bushSpotRange: 55, // inside a bush, only spotted closer than this
  waypointPause: 0.8, // s stopped at each waypoint, scanning
  scanSpeed: 0.8, // rad/s while scanning
  loseSight: 3, // s unseen before a chase gives up
  investigateTime: 4, // s spent scanning an investigated point
  chaseSpeed: 150, // px/s
};

export const SUSPICION = {
  closeRate: 1.4, // per second, courier near (inside half vision range)
  farRate: 0.35, // per second, courier far but visible
  lampMultiplier: 1.6,
  runMultiplier: 1.5,
  decay: 0.5, // per second while unseen
  bushMultiplier: 0.5,
  investigateAt: 0.45,
  chaseAt: 1.0,
};

export const LETTER_PICKUP_RADIUS = 24;

// Patrol speeds, one per guard, in level order (Wren, Kett, Sable).
export const PATROL_SPEEDS = [70, 80, 90];

export const PALETTE = {
  ground: '#0d1526',
  groundAlt: '#111c30',
  wall: '#2c3a55',
  wallTop: '#3a4c6e',
  crate: '#5a4632',
  crateEdge: '#7a6248',
  bush: '#1e4d2a',
  bushEdge: '#2f7a3e',
  lamp: 'rgba(255, 214, 130, 0.10)',
  lampEdge: 'rgba(255, 214, 130, 0.35)',
  exit: '#1f7a3a',
  exitEdge: '#37c25a',
  letter: '#f2e3b3',
  letterEdge: '#c9a86a',
  player: '#e8e8e8',
  playerCoat: '#274b8f',
  guard: '#8f2f2f',
  guardEdge: '#c25a5a',
  cone: 'rgba(255, 220, 120, 0.16)',
  coneEdge: 'rgba(255, 220, 120, 0.35)',
  coneChase: 'rgba(255, 80, 60, 0.22)',
  coneChaseEdge: 'rgba(255, 80, 60, 0.55)',
  text: '#e8e8e8',
  dim: '#9aa7bd',
  danger: '#ff5a4a',
  gold: '#ffd682',
};
