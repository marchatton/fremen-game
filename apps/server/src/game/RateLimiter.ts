export class RateLimiter {
  private timestamps: Map<string, number[]> = new Map();

  check(key: string, maxRequests: number, windowMs: number): boolean {
    const now = Date.now();
    const requests = this.timestamps.get(key) || [];
    
    const validRequests = requests.filter(timestamp => now - timestamp < windowMs);
    
    if (validRequests.length >= maxRequests) {
      return false;
    }

    validRequests.push(now);
    this.timestamps.set(key, validRequests);
    
    return true;
  }

  cleanup(maxAge: number) {
    const now = Date.now();
    for (const [key, timestamps] of this.timestamps) {
      const validTimestamps = timestamps.filter(t => now - t < maxAge);
      if (validTimestamps.length === 0) {
        this.timestamps.delete(key);
      } else {
        this.timestamps.set(key, validTimestamps);
      }
    }
  }
}
