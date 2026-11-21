// Night Post, level one: "The Courtyard". One walled courtyard at night, drawn as data:
// walls and crates block movement and sight, bushes hide the courier, lamps make the
// courier easier to spot, letters are the goal, the gate is the way out. Every guard
// patrol loop was checked leg by leg against every wall and crate, so no patrol ever
// walks through solid cover. Coordinates are field pixels (1280x720).
//
// Wren's patrol was moved east in the finish pass: she used to walk the west leg at
// x=150, head-on into the courier walking north to the first letter at (150,120).
// She now patrols up and down x=260 alone, so the walk to letter 1 is clear of her.

export const LEVEL = {
  name: 'The Courtyard',

  /** Walls: solid rectangles that block movement and line of sight. */
  walls: [
    // The courtyard's border.
    { x: 0, y: 0, w: 1280, h: 24 },
    { x: 0, y: 696, w: 1280, h: 24 },
    { x: 0, y: 0, w: 24, h: 720 },
    { x: 1256, y: 0, w: 24, h: 720 },
    // The west wall, with a gate in it at y 300-420 between the south and north rooms.
    { x: 300, y: 0, w: 24, h: 300 },
    { x: 300, y: 420, w: 24, h: 276 },
    // The middle wall, open at the top (y 0-120) and the bottom (y 480-696).
    { x: 640, y: 120, w: 24, h: 360 },
    // The east wall, open only at the top (y 0-240): the gate's side is the hard side.
    { x: 960, y: 240, w: 24, h: 456 },
    // A low wall in the north-middle room, cover beside the first lamp.
    { x: 400, y: 90, w: 160, h: 24 },
    // A low wall across the south-middle room, cover for the bottom crossing.
    { x: 700, y: 540, w: 220, h: 24 },
    // A low wall in the north-east room, cover on the way to the gate.
    { x: 960, y: 120, w: 140, h: 24 },
  ],

  /** Crates: low solid blocks, cover that blocks movement and sight. Each sits clear of
   *  every guard patrol leg (a crate on a leg traps the guard against it forever). */
  crates: [
    { x: 340, y: 180, w: 56, h: 56 },
    { x: 600, y: 520, w: 56, h: 56 },
    { x: 820, y: 300, w: 56, h: 56 },
    { x: 1000, y: 480, w: 56, h: 56 },
    { x: 180, y: 520, w: 56, h: 56 },
  ],

  /** Bushes: circles the courier can stand in. A guard cannot spot the courier inside
   *  a bush unless it comes very close. Bushes block nothing else. */
  bushes: [
    { x: 430, y: 60, r: 34 },
    { x: 760, y: 200, r: 34 },
    { x: 180, y: 340, r: 34 },
    { x: 560, y: 620, r: 34 },
    { x: 1100, y: 340, r: 34 },
    { x: 880, y: 620, r: 34 },
  ],

  /** Lamps: pools of light, radius r. Standing in one makes the courier easier to spot. */
  lamps: [
    { x: 500, y: 120, r: 90 },
    { x: 840, y: 420, r: 90 },
    { x: 240, y: 600, r: 90 },
    { x: 1120, y: 160, r: 90 },
  ],

  /** The three letters, in the order the courier usually finds them. */
  letters: [
    { x: 150, y: 120 },
    { x: 1140, y: 620 },
    { x: 760, y: 80 },
  ],

  playerStart: { x: 80, y: 640 },

  /** The gate: the courier must stand in it carrying all three letters. */
  exit: { x: 1180, y: 60, w: 52, h: 52 },

  /** Guards: patrol loops (closed, in order) and patrol speed in pixels per second. */
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
