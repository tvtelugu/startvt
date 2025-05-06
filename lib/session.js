import { serialize } from 'cookie';

export function setSessionCookie(res, sessionId) {
  res.setHeader('Set-Cookie', [
    serialize('sessionId', sessionId, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 // 1 day
    }),
    serialize('sessionActive', '1', {
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24
    })
  ]);
}

export function parseSessionCookie(req) {
  const cookies = req.cookies || {};
  return {
    sessionId: cookies.sessionId,
    isActive: cookies.sessionActive === '1'
  };
}
