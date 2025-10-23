/**
 * Seeded pseudo-random number generator
 * Uses a simple LCG (Linear Congruential Generator) algorithm
 */
export class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  /**
   * Generate next random number between 0 and 1
   */
  next(): number {
    // LCG parameters (same as used in glibc)
    const a = 1103515245;
    const c = 12345;
    const m = 2 ** 31;

    this.seed = (a * this.seed + c) % m;
    return this.seed / m;
  }

  /**
   * Generate random integer between min (inclusive) and max (inclusive)
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * Generate random float between min and max
   */
  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  /**
   * Reset seed
   */
  setSeed(seed: number): void {
    this.seed = seed;
  }
}
