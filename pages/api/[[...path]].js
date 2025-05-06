import { withSession } from '../../lib/session';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

const CONFIG = {
  baseUrl: 'http://starshare.org:80',
  paths: {
    live: '/live/42166/42166',
    movies: '/movies',
    series: '/series'
  },
  cacheTime: 60 * 1000, // 1 minute
  maxDevices: 20
};

const CACHE_DIR = path.join(process.cwd(), 'cache');
!fs.existsSync(CACHE_DIR) && fs.mkdirSync(CACHE_DIR, { recursive: true });

const HEADERS = {
  'Icy-MetaData': '1',
  'Accept-Encoding': 'identity',
  'Host': new URL(CONFIG.baseUrl).hostname,
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
};

async function extractStreamUrl(url) {
  try {
    const response = await axios.head(url, { 
      headers: HEADERS,
      maxRedirects: 0,
      validateStatus: null
    });
    return response.status === 302 ? response.headers.location : null;
  } catch (error) {
    return error.response?.headers?.location || null;
  }
}

export default withSession(async (req, res) => {
  const [endpoint] = req.query.path || [];
  const { id } = req.query;

  // Validate request
  if (!CONFIG.paths[endpoint]) {
    return res.status(404).json({ error: 'Invalid endpoint' });
  }
  if (!id) {
    return res.status(400).json({ error: 'ID parameter required' });
  }

  // Check device limit
  if (req.session.devices >= CONFIG.maxDevices) {
    return res.status(429).json({ error: 'Device limit reached' });
  }

  try {
    // Cache handling
    const cacheFile = path.join(CACHE_DIR, `${endpoint}_${id}.cache`);
    let streamUrl = fs.existsSync(cacheFile) && 
                   (Date.now() - fs.statSync(cacheFile).mtimeMs < CONFIG.cacheTime)
                   ? fs.readFileSync(cacheFile, 'utf8')
                   : null;

    if (!streamUrl) {
      const sourceUrl = `${CONFIG.baseUrl}${CONFIG.paths[endpoint]}/${id}.${endpoint === 'live' ? 'ts' : 'mp4'}`;
      streamUrl = await extractStreamUrl(sourceUrl);
      streamUrl && fs.writeFileSync(cacheFile, streamUrl);
    }

    if (!streamUrl) {
      return res.status(502).json({ error: 'Stream unavailable' });
    }

    // Update session
    req.session.devices = (req.session.devices || 0) + 1;
    await req.session.save();

    return res.redirect(streamUrl);

  } catch (error) {
    console.error(`[${endpoint}] Error:`, error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
