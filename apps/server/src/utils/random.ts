/**
 * Seeded random number generator using mulberry32 algorithm
 * Returns a function that generates pseudo-random numbers in [0, 1)
 *
 * @param seed - Seed value for deterministic generation
 * @returns Function that returns random numbers
 */
export function seededRandom(seed: number): () => number {
  let state = seed;

  return function() {
    // Mulberry32 algorithm
    state |= 0;
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
