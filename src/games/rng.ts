/** A random number generator returning floats in [0, 1). */
export type Rng = () => number;

/**
 * Mulberry32 — tiny, fast, seedable PRNG. Seeded randomness makes game logic reproducible,
 * which is what lets the property tests replay any failing case exactly.
 */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fresh random seed for a live round. */
export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff);
}

/** Integer in [0, maxExclusive). */
export function randInt(rng: Rng, maxExclusive: number): number {
  return Math.floor(rng() * maxExclusive);
}
