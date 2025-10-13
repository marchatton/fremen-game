import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-change-in-production';
const JWT_EXPIRY = '24h';

export interface JWTPayload {
  playerId: string;
  username?: string;
}

export function generateToken(playerId?: string, username?: string): string {
  const payload: JWTPayload = {
    playerId: playerId || uuidv4(),
    username: username || `Player_${Math.random().toString(36).substring(7)}`,
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}
