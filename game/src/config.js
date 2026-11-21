// Night Post — all tuning values and the night palette.
// One place for every number the simulation and the renderer share,
// so a tweak here changes the game everywhere at once.

export const FIELD_W = 1280;
export const FIELD_H = 720;

export const PLAYER = {
  radius: 14,
  walkSpeed: 170,
  sneakSpeed: 85,
  runNoiseRadius: 100,
  sneakNoiseRadius: 30,
  noiseInterval: 0.5,
};

export const GUARD = {
  radius: 14,
  visionRange: 230,
  visionHalfAngle: 0.6,
  catchRadius: 26,
  bushSpotRange: 55,
  waypointPause: 0.8,
  scanSpeed: 0.8,
  loseSightTime: 3,
  investigateTime: 4,
  chaseSpeed: 150,
  patrolSpeeds: [70, 80, 90],
};

export const SUSPICION = {
  closeRate: 1.4,
  farRate: 0.35,
  lampMultiplier: 1.6,
  runMultiplier: 1.5,
  decayRate: 0.5,
  bushMultiplier: 0.5,
  investigateAt: 0.45,
  chaseAt: 1.0,
};

export const LETTER_PICKUP_RADIUS = 24;

export const PALETTE = {
  night: '#0b1026',
  ground: '#141b33',
  groundAlt: '#10182e',
  wall: '#2c3554',
  wallTop: '#3a4568',
  crate: '#4a3a28',
  crateTop: '#6b5636',
  bush: '#1d4d2b',
  bushDark: '#143a20',
  lampGlow: 'rgba(255, 214, 120, 0.16)',
  lampCore: '#ffd678',
  letter: '#f5e6a3',
  player: '#e8b64c',
  playerSneak: '#c98f2e',
  guard: '#c94f4f',
  guardCone: 'rgba(255, 214, 110, 0.20)',
  guardConeAlert: 'rgba(255, 80, 60, 0.30)',
  exit: '#3fbf6f',
  exitGlow: 'rgba(63, 191, 111, 0.25)',
  text: '#e8ecf7',
  textDim: '#9aa5c4',
  title: '#f5e6a3',
  danger: '#ff5a4e',
};
