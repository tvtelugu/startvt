import { withIronSession } from 'next-iron-session';

export const sessionConfig = {
  password: process.env.SESSION_SECRET || 'complex_password_at_least_32_characters',
  cookieName: 'stream-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    httpOnly: true
  },
  ttl: 60 * 60 * 24 // 1 day
};

export function withSession(handler) {
  return withIronSession(handler, sessionConfig);
}
