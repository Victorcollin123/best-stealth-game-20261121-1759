// Night Post — the level: one walled courtyard at night.
// Rects are {x, y, w, h}; points are {x, y}. Every patrol leg was
// checked against every wall and crate, so guards never walk through one.

export const WALLS = [
  // Border, 24 thick.
  { x: 0, y: 0, w: 1280, h: 24 },
  { x: 0, y: 696, w: 1280, h: 24 },
  { x: 0, y: 0, w: 24, h: 720 },
  { x: 1256, y: 0, w: 24, h: 720 },
  // Interior walls.
  { x: 300, y: 0, w: 24, h: 300 }, // W1 — gap y 300–420 below it
  { x: 300, y: 420, w: 24, h: 276 }, // W2
  { x: 640, y: 120, w: 24, h: 360 }, // W3 — open top y 0–120, bottom y 480–696
  { x: 960, y: 240, w: 24, h: 456 }, // W4 — open only at the top, y 0–240
  { x: 400, y: 90, w: 160, h: 24 }, // W5
  { x: 700, y: 540, w: 220, h: 24 }, // W6
  { x: 960, y: 120, w: 140, h: 24 }, // W7
];

export const CRATES = [
  { x: 340, y: 180, w: 56, h: 56 }, // C1
  { x: 600, y: 520, w: 56, h: 56 }, // C2
  { x: 820, y: 300, w: 56, h: 56 }, // C3
  { x: 1000, y: 480, w: 56, h: 56 }, // C4
  { x: 180, y: 520, w: 56, h: 56 }, // C5
];

// Every solid thing a body or a sight-line can collide with.
export const SOLIDS = [...WALLS, ...CRATES];

export const BUSHES = [
  { x: 430, y: 60, r: 34 }, // B1
  { x: 760, y: 200, r: 34 }, // B2
  { x: 180, y: 340, r: 34 }, // B3
  { x: 560, y: 620, r: 34 }, // B4
  { x: 1100, y: 340, r: 34 }, // B5
  { x: 880, y: 620, r: 34 }, // B6
];

export const LAMPS = [
  { x: 500, y: 120, r: 90 }, // L1
  { x: 840, y: 420, r: 90 }, // L2
  { x: 240, y: 600, r: 90 }, // L3
  { x: 1120, y: 160, r: 90 }, // L4
];

export const LETTERS = [
  { x: 150, y: 120 },
  { x: 1140, y: 620 },
  { x: 760, y: 80 },
];

export const PLAYER_START = { x: 80, y: 640 };

export const EXIT = { x: 1180, y: 60, w: 52, h: 52 };

export function exitCenter() {
  return { x: EXIT.x + EXIT.w / 2, y: EXIT.y + EXIT.h / 2 };
}

// Guards. Wren patrols ONLY the x=260 leg (waypoints (260,200),
// (260,600)) — the west leg moved east so the walk to letter 1 at
// (150,120) is no longer a head-on meeting in a narrow corridor.
export const GUARDS = [
  {
    name: 'Wren',
    speed: 70,
    waypoints: [
      { x: 260, y: 200 },
      { x: 260, y: 600 },
    ],
  },
  {
    name: 'Kett',
    speed: 80,
    waypoints: [
      { x: 430, y: 140 },
      { x: 430, y: 480 },
      { x: 560, y: 480 },
      { x: 560, y: 140 },
    ],
  },
  {
    name: 'Sable',
    speed: 90,
    waypoints: [
      { x: 1080, y: 300 },
      { x: 1180, y: 300 },
      { x: 1180, y: 560 },
      { x: 1080, y: 560 },
    ],
  },
];
