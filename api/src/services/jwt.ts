import jwt from 'jsonwebtoken';

const SECRET  = process.env.JWT_SECRET!;
const EXPIRES = '30d';

export interface JWTPayload {
  userId: string;
  email:  string;
}

export function signJWT(payload: JWTPayload): string {
  if (!SECRET) throw new Error('JWT_SECRET environment variable is not set');
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES });
}

export function verifyJWT(token: string): JWTPayload {
  if (!SECRET) throw new Error('JWT_SECRET environment variable is not set');
  return jwt.verify(token, SECRET) as JWTPayload;
}
