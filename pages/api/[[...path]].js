import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { setSessionCookie, parseSessionCookie } from '../../lib/session';

// In-memory session store (replace with Redis in production)
const sessions = new Map();

const CONFIG = {
  baseUrl: 'https://starshare.st:443',
  paths: {
    live: '/live/42166/42166',
    movies: '/movies',
    series: '/series'
  },
  maxDevices: 20,
  cacheTime: 60 * 1000 // 1 minute
};

// Initialize cache directory
const CACHE_DIR = path.join(process.cwd(), 'cache');
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

const getOrCreateSession = (req) => {
  const { sessionId } = parseSessionCookie(req);
  
  if (sessionId && sessions.has(sessionId)) {
    return { 
      id: sessionId, 
      data: sessions.get(sessionId),
      isNew: false
    };
  }

  // Create new session
  const newId = Math.random().toString(36).substring(2, 15);
  const newSession = {
    devices: 0,
    createdAt: Date.now()
  };
  sessions.set(newId, newSession);
  
  return {
    id: newId,
    data: newSession,
    isNew: true
  };
};

export default async function handler(req, res) {
  const [endpoint] = req.query.path || [];
  const { id } = req.query;

  // Validate endpoint
  if (!CONFIG.paths[endpoint]) {
    return res.status(404).json({ error: 'Invalid endpoint' });
  }

  // Validate ID
  if (!id) {
    return res.status(400).json({ error: 'ID parameter required' });
  }

  // Session handling
  const { id: sessionId, data: session, isNew } = getOrCreateSession(req);

  // Device limit check
  if (session.devices >= CONFIG.maxDevices) {
    return res.status(429).json({ error: 'Device limit reached' });
  }

  try {
    // Cache handling
    const cacheKey = `${endpoint}_${id.replace(/[^a-z0-9]/gi, '_')}`;
    const cacheFile = path.join(CACHE_DIR, `${cacheKey}.cache`);
    
    let streamUrl = fs.existsSync(cacheFile) && 
                   (Date.now() - fs.statSync(cacheFile).mtimeMs < CONFIG.cacheTime)
                   ? fs.readFileSync(cacheFile, 'utf8')
                   : null;

    if (!streamUrl) {
      const sourceUrl = `${CONFIG.baseUrl}${CONFIG.paths[endpoint]}/${id}.${endpoint === 'live' ? 'ts' : 'mp4'}`;
      streamUrl = await getStreamUrl(sourceUrl);
      streamUrl && fs.writeFileSync(cacheFile, streamUrl);
    }

    if (!streamUrl) {
      return res.status(502).json({ error: 'Stream unavailable' });
    }

    // Update session
    session.devices += 1;
    sessions.set(sessionId, session);

    // Set cookie if new session
    if (isNew) {
      setSessionCookie(res, sessionId);
    }

    return res.redirect(307, streamUrl);

  } catch (error) {
    console.error(`[${endpoint}] Error:`, error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getStreamUrl(url) {
  try {
    const response = await axios.head(url, {
      headers: {
        'Icy-MetaData': '1',
        'Accept-Encoding': 'identity',
        'User-Agent': 'Mozilla/5.0'
      },
      maxRedirects: 0,
      validateStatus: null
    });
    return response.status === 302 ? response.headers.location : null;
  } catch (error) {
    return error.response?.headers?.location || null;
  }
}

// Session cleanup every hour
setInterval(() => {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  
  for (const [sessionId, session] of sessions.entries()) {
    if (now - session.createdAt > oneDay) {
      sessions.delete(sessionId);
    }
  }
}, 60 * 60 * 1000);
