import fs from 'fs';
import path from 'path';
import axios from 'axios';

// Configuration
const CONFIG = {
  baseUrl: 'http://starshare.org:80',
  paths: {
    live: '/live/42166/42166',
    movies: '/movies',
    series: '/series'
  },
  maxDevices: 20,
  cacheTime: 60 * 1000, // 1 minute
  cacheDir: path.join(process.cwd(), 'cache')
};

// Initialize cache directory
if (!fs.existsSync(CONFIG.cacheDir)) {
  fs.mkdirSync(CONFIG.cacheDir, { recursive: true });
}

// In-memory session store (replace with Redis in production)
const sessions = new Map();

const getSession = (req) => {
  const sessionId = req.cookies?.sessionId || generateSessionId();
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, { 
      active_devices: 0, 
      createdAt: Date.now(),
      lastActive: Date.now()
    });
  }
  return { 
    id: sessionId, 
    data: sessions.get(sessionId),
    isNew: !req.cookies?.sessionId
  };
};

const generateSessionId = () => {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
};

const HEADERS = {
  'Icy-MetaData': '1',
  'Accept-Encoding': 'identity',
  'Host': new URL(CONFIG.baseUrl).hostname,
  'Connection': 'Keep-Alive',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
};

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { path = [], id } = req.query;
  const [endpoint] = path;

  // Validate endpoint
  if (!CONFIG.paths[endpoint]) {
    return res.status(404).json({ 
      error: 'Invalid endpoint', 
      validEndpoints: Object.keys(CONFIG.paths) 
    });
  }

  // Validate ID parameter
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ 
      error: 'ID parameter is required and must be a string' 
    });
  }

  // Session management
  const { id: sessionId, data: session, isNew } = getSession(req);
  
  // Device limit check
  if (session.active_devices >= CONFIG.maxDevices) {
    return res.status(429).json({ 
      error: `Maximum of ${CONFIG.maxDevices} devices reached`,
      code: 429
    });
  }

  try {
    // Cache handling
    const cacheKey = `${endpoint}_${id.replace(/[^a-z0-9]/gi, '_')}`;
    const cacheFile = path.join(CONFIG.cacheDir, `${cacheKey}.cache`);
    
    // Check cache
    let domain = null;
    if (fs.existsSync(cacheFile)) {
      const stats = fs.statSync(cacheFile);
      if (Date.now() - stats.mtimeMs < CONFIG.cacheTime) {
        domain = fs.readFileSync(cacheFile, 'utf8');
      }
    }

    // If not cached or expired
    if (!domain) {
      const streamUrl = `${CONFIG.baseUrl}${CONFIG.paths[endpoint]}/${id}.${endpoint === 'live' ? 'ts' : 'mp4'}`;
      domain = await extractStreamUrl(streamUrl);
      
      // Update cache if we got a valid domain
      if (domain) {
        fs.writeFileSync(cacheFile, domain);
      }
    }

    if (!domain) {
      return res.status(502).json({ 
        error: 'Unable to retrieve streaming URL',
        code: 502
      });
    }

    // Update session
    session.active_devices += 1;
    session.lastActive = Date.now();
    sessions.set(sessionId, session);

    // Set session cookie if new
    if (isNew) {
      res.setHeader('Set-Cookie', [
        `sessionId=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24}`,
        `sessionActive=1; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24}`
      ]);
    }

    // Redirect to the actual stream URL
    return res.redirect(307, domain);

  } catch (error) {
    console.error(`[${endpoint}] Error:`, error);
    return res.status(500).json({ 
      error: 'Internal server error',
      code: 500
    });
  }
}

async function extractStreamUrl(url) {
  try {
    // Using HEAD request to avoid downloading the entire file
    const response = await axios({
      method: 'head',
      url,
      headers: HEADERS,
      maxRedirects: 0,
      validateStatus: null // Don't throw on non-2xx status
    });

    if (response.status === 302 && response.headers.location) {
      return response.headers.location;
    }
  } catch (error) {
    if (error.response?.status === 302 && error.response.headers.location) {
      return error.response.headers.location;
    }
    console.error('Error extracting stream URL:', error.message);
  }
  return null;
}

// Clean up old sessions periodically
setInterval(() => {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  
  for (const [sessionId, session] of sessions.entries()) {
    if (now - session.lastActive > oneDay) {
      sessions.delete(sessionId);
    }
  }
}, 60 * 60 * 1000); // Run every hour
