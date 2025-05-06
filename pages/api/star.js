import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

// Configuration
const CONFIG = {
  baseUrl: 'http://starshare.org:80',
  paths: {
    live: '/live/love95/love95',
    movies: '/movies',
    series: '/series'
  },
  maxDevices: 20,
  cacheTime: 60 * 1000 // 1 minute
};

// Cache directory setup
const CACHE_DIR = path.join(process.cwd(), 'cache');
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Session simulation (in-memory for demo - use proper session store in production)
const sessions = {};

const getSession = (req) => {
  const sessionId = req.headers['x-session-id'] || req.cookies.sessionId || Math.random().toString(36).substring(2);
  if (!sessions[sessionId]) {
    sessions[sessionId] = { active_devices: 0 };
  }
  return { id: sessionId, data: sessions[sessionId] };
};

const updateSession = (sessionId, data) => {
  sessions[sessionId] = data;
};

// Common headers
const HEADERS = {
  'Icy-MetaData': '1',
  'Accept-Encoding': 'identity',
  'Host': new URL(CONFIG.baseUrl).hostname,
  'Connection': 'Keep-Alive',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
};

async function extractDomain(url) {
  try {
    const response = await axios({
      method: 'get',
      url,
      headers: HEADERS,
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400
    });
  } catch (error) {
    if (error.response?.status === 302) {
      return error.response.headers.location;
    }
    console.error(`Error extracting domain from ${url}:`, error.message);
    return false;
  }
  return false;
}

export default async function handler(req, res) {
  const { path = [], id } = req.query;
  const endpoint = path[0]; // 'live', 'movies', or 'series'

  // Validate endpoint
  if (!CONFIG.paths[endpoint]) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }

  // Validate ID
  if (!id) {
    return res.status(400).json({ error: 'ID parameter is required' });
  }

  // Get or create session
  const { id: sessionId, data: session } = getSession(req);

  // Check device limit
  if (session.active_devices >= CONFIG.maxDevices) {
    return res.status(429).json({ error: 'Maximum number of devices reached' });
  }

  // Process request
  try {
    const cacheKey = `${endpoint}_${id}`;
    const cacheFile = path.join(CACHE_DIR, `${cacheKey}.cache`);
    const contentPath = CONFIG.paths[endpoint];
    const fullUrl = `${CONFIG.baseUrl}${contentPath}/${id}.${endpoint === 'live' ? 'ts' : 'mp4'}`;

    let domain;
    
    // Check cache first
    if (fs.existsSync(cacheFile) && (Date.now() - fs.statSync(cacheFile).mtimeMs < CONFIG.cacheTime)) {
      domain = fs.readFileSync(cacheFile, 'utf8');
    } else {
      domain = await extractDomain(fullUrl);
      if (domain) {
        fs.writeFileSync(cacheFile, domain);
      }
    }

    if (!domain) {
      return res.status(502).json({ error: 'Unable to retrieve streaming URL' });
    }

    // Update session
    session.active_devices++;
    updateSession(sessionId, session);

    // Set session cookie if not already set
    if (!req.cookies.sessionId) {
      res.setHeader('Set-Cookie', `sessionId=${sessionId}; Path=/; HttpOnly; SameSite=Lax`);
    }

    return res.redirect(domain);
    
  } catch (error) {
    console.error(`${endpoint} endpoint error:`, error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
