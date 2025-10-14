import { describe, it, expect } from 'vitest';
import { generateToken, verifyToken } from './jwt';

describe('JWT Authentication', () => {
  it('should generate a valid token', () => {
    const token = generateToken();
    
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
  });

  it('should generate token with custom playerId', () => {
    const playerId = 'custom-player-123';
    const token = generateToken(playerId);
    const payload = verifyToken(token);
    
    expect(payload).toBeDefined();
    expect(payload?.playerId).toBe(playerId);
  });

  it('should generate token with custom username', () => {
    const username = 'TestUser';
    const token = generateToken(undefined, username);
    const payload = verifyToken(token);
    
    expect(payload).toBeDefined();
    expect(payload?.username).toBe(username);
  });

  it('should verify valid token', () => {
    const token = generateToken('player1', 'TestUser');
    const payload = verifyToken(token);
    
    expect(payload).not.toBeNull();
    expect(payload?.playerId).toBe('player1');
    expect(payload?.username).toBe('TestUser');
  });

  it('should reject invalid token', () => {
    const payload = verifyToken('invalid-token-string');
    
    expect(payload).toBeNull();
  });

  it('should reject tampered token', () => {
    const token = generateToken('player1', 'TestUser');
    const tamperedToken = token + 'tampered';
    const payload = verifyToken(tamperedToken);
    
    expect(payload).toBeNull();
  });

  it('should generate unique playerIds by default', () => {
    const token1 = generateToken();
    const token2 = generateToken();
    
    const payload1 = verifyToken(token1);
    const payload2 = verifyToken(token2);
    
    expect(payload1?.playerId).not.toBe(payload2?.playerId);
  });

  it('should include username in token', () => {
    const token = generateToken();
    const payload = verifyToken(token);
    
    expect(payload?.username).toBeDefined();
    expect(typeof payload?.username).toBe('string');
  });
});
