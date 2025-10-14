import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RateLimiter } from './RateLimiter';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter();
    vi.useFakeTimers();
  });

  it('should allow first request', () => {
    const result = rateLimiter.check('user1', 1, 1000);
    expect(result).toBe(true);
  });

  it('should block second request within window', () => {
    rateLimiter.check('user1', 1, 1000);
    const result = rateLimiter.check('user1', 1, 1000);
    
    expect(result).toBe(false);
  });

  it('should allow request after window expires', () => {
    rateLimiter.check('user1', 1, 1000);
    
    vi.advanceTimersByTime(1001);
    
    const result = rateLimiter.check('user1', 1, 1000);
    expect(result).toBe(true);
  });

  it('should track different keys independently', () => {
    rateLimiter.check('user1', 1, 1000);
    const result = rateLimiter.check('user2', 1, 1000);
    
    expect(result).toBe(true);
  });

  it('should respect maxRequests parameter', () => {
    const result1 = rateLimiter.check('user1', 3, 1000);
    const result2 = rateLimiter.check('user1', 3, 1000);
    const result3 = rateLimiter.check('user1', 3, 1000);
    const result4 = rateLimiter.check('user1', 3, 1000);
    
    expect(result1).toBe(true);
    expect(result2).toBe(true);
    expect(result3).toBe(true);
    expect(result4).toBe(false);
  });

  it('should cleanup old timestamps', () => {
    rateLimiter.check('user1', 1, 1000);
    
    vi.advanceTimersByTime(2000);
    rateLimiter.cleanup(1000);
    
    const result = rateLimiter.check('user1', 1, 1000);
    expect(result).toBe(true);
  });
});
