// Night Post — the level: one walled courtyard, its walls, crates, bushes,
// lamps, letters, the courier's start, the green gate, and the three guards.
// Every patrol leg was checked against every wall and crate: no leg crosses
// a solid. Wren patrols only the x=260 column, so the walk up the west side
// to the first letter is never a head-on meeting in a narrow corridor.

export const LEVEL = {
  // Solids. The border is 24 thick; the inner walls leave gaps to slip through:
  // W1/W2 leave a gap at y 300-420; W3 is open top (y 0-120) and bottom
  // (y 480-696); W4 is open only at the top (y 0-240).
  walls: [
    { x: 0, y: 0, w: 1280, h: 24 }, // border top
    { x: 0, y: 696, w: 1280, h: 24 }, // border bottom
    { x: 0, y: 0, w: 24, h: 720 }, // border left
    { x: 1256, y: 0, w: 24, h: 720 }, // border right
    { x: 300, y: 0, w: 24, h: 300 }, // W1
    { x: 300, y: 420, w: 24, h: 276 }, // W2
    { x: 640, y: 120, w: 24, h: 360 }, // W3
    { x: 960, y: 240, w: 24, h: 456 }, // W4
    { x: 400, y: 90, w: 160, h: 24 }, // W5
    { x: 700, y: 540, w: 220, h: 24 }, // W6
    { x: 960, y: 120, w: 140, h: 24 }, // W7
  ],
  crates: [
    { x: 340, y: 180, w: 56, h: 56 }, // C1
    { x: 600, y: 520, w: 56, h: 56 }, // C2
    { x: 820, y: 300, w: 56, h: 56 }, // C3
    { x: 1000, y: 480, w: 56, h: 56 }, // C4
    { x: 180, y: 520, w: 56, h: 56 }, // C5
  ],
  // Bushes hide the courier (radius 34). Lamps light it up (radius 90).
  bushes: [
    { x: 430, y: 60, r: 34 }, // B1
    { x: 760, y: 200, r: 34 }, // B2
    { x: 180, y: 340, r: 34 }, // B3
    { x: 560, y: 620, r: 34 }, // B4
    { x: 1100, y: 340, r: 34 }, // B5
    { x: 880, y: 620, r: 34 }, // B6
  ],
  lamps: [
    { x: 500, y: 120, r: 90 }, // L1
    { x: 840, y: 420, r: 90 }, // L2
    { x: 240, y: 600, r: 90 }, // L3
    { x: 1120, y: 160, r: 90 }, // L4
  ],
  letters: [
    { x: 150, y: 120 },
    { x: 1140, y: 620 },
    { x: 760, y: 80 },
  ],
  playerStart: { x: 80, y: 640 },
  exit: { x: 1180, y: 60, w: 52, h: 52 },
  guards: [
    {
      name: 'Wren',
      waypoints: [
        { x: 260, y: 200 },
        { x: 260, y: 600 },
      ],
      speed: 70,
    },
    {
      name: 'Kett',
      waypoints: [
        { x: 430, y: 140 },
        { x: 430, y: 480 },
        { x: 560, y: 480 },
        { x: 560, y: 140 },
      ],
      speed: 80,
    },
    {
      name: 'Sable',
      waypoints: [
        { x: 1080, y: 300 },
        { x: 1180, y: 300 },
        { x: 1180, y: 560 },
        { x: 1080, y: 560 },
      ],
      speed: 90,
    },
  ],
};

// All solid rectangles (walls + crates) for collision and line of sight.
export function solids() {
  return [...LEVEL.walls, ...LEVEL.crates];
}
