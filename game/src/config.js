// Night Post: every tuning number and colour lives here, so the rules can be
// read in one place. The courtyard is a fixed 1280x720 field; the renderer
// scales it to the window, so nothing below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second, whatever the display does. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 14,
  walkSpeed: 170,
  sneakSpeed: 85,
  /** Hearing range of a footstep, in pixels: running carries far, sneaking barely at all. */
  runNoise: 100,
  sneakNoise: 30,
  /** Seconds between footstep noises while the courier is moving. */
  noiseInterval: 0.5,
};

export const GUARD = {
  radius: 14,
  /** How far a guard can see, and half the vision cone's angle in radians. */
  visionRange: 230,
  visionHalfAngle: 0.6,
  /** A guard that has noticed the courier catches it this close. */
  catchRadius: 26,
  /** Inside a bush, a guard only spots the courier closer than this. */
  bushSpotRange: 55,
  /** Seconds a guard waits at each patrol waypoint, looking around. */
  waypointPause: 0.8,
  /** Pixels per second a guard runs when it is chasing the courier. */
  chaseSpeed: 150,
  /** Radians per second a guard turns while waiting or searching. */
  scanSpeed: 0.8,
  /** Seconds a chasing guard keeps hunting after losing sight. */
  loseSightSeconds: 3,
  /** Seconds a guard searches the last-seen spot before giving up. */
  investigateSeconds: 4,
};

/** Suspicion 0..1 per guard: 0.45 makes it investigate, 1 makes it chase. */
export const SUSPICION = {
  investigateAt: 0.45,
  /** Rise per second at point-blank range, falling to farRate at the cone's edge. */
  closeRate: 1.4,
  farRate: 0.35,
  /** Multipliers on the rise: standing in lamplight, and running instead of sneaking. */
  lampMultiplier: 1.6,
  runMultiplier: 1.5,
  /** Fall per second while the courier is not visible. */
  decayRate: 0.5,
};

/** How many letters the courier must carry before the gate opens. */
export const LETTERS_TO_WIN = 3;
/** Picking a letter up this close counts. */
export const LETTER_PICKUP_RADIUS = 24;

export const PALETTE = {
  backdrop: '#0b0e14',
  floor: '#1c2129',
  floorDark: '#171b23',
  tileLine: '#232936',
  wall: '#3a4152',
  wallTop: '#4a5266',
  crate: '#5a4632',
  crateTop: '#6e583f',
  bush: '#1f3d24',
  bushLight: '#2c5231',
  lampGlow: '#f2c94c',
  lampPool: 'rgba(242, 201, 76, 0.10)',
  cone: 'rgba(242, 201, 76, 0.16)',
  coneAlert: 'rgba(229, 83, 75, 0.28)',
  coneSuspicious: 'rgba(242, 160, 76, 0.22)',
  guard: '#c94f43',
  guardDark: '#8f352c',
  player: '#4fc3f7',
  playerDark: '#2b7ea6',
  letter: '#f2e394',
  exit: '#7ee787',
  exitDark: '#2f6b34',
  panel: '#202634',
  panelEdge: '#39415a',
  text: '#eef1f5',
  muted: '#9aa3b5',
  danger: '#e5534b',
  gold: '#f2c94c',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best delivery time is kept between visits (this browser only). */
export const BEST_KEY = 'night-post.best';
