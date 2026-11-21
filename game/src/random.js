// Night Post — mulberry32, a tiny fast seeded RNG.
// Seeds only offset where each guard starts its patrol loop, so a given
// seed always replays the same night.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pick an integer in [0, n) from a seeded RNG.
export function randInt(rng, n) {
  return Math.floor(rng() * n);
}
