// pages/api/live.m3u8.js
import path from 'path';
import { promises as fs } from 'fs';

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache
const FALLBACK_STREAM = 'https://tvtelugu.github.io/er/720p.m3u8';
let channelCache = {
  data: null,
  lastUpdated: 0
};

// Helper function to load channels
async function loadChannels() {
  const now = Date.now();
  
  // Return cached data if still valid
  if (channelCache.data && now - channelCache.lastUpdated < CACHE_TTL) {
    return channelCache.data;
  }

  try {
    const filePath = path.join(process.cwd(), 'public', 'channels.json');
    const fileData = await fs.readFile(filePath, 'utf8');
    const channels = JSON.parse(fileData);
    
    // Transform into more efficient lookup format
    const channelMap = channels.reduce((map, channel) => {
      if (channel.Name && channel.Url) {
        map[channel.Name.toLowerCase()] = channel.Url;
      }
      return map;
    }, {});

    // Update cache
    channelCache = {
      data: channelMap,
      lastUpdated: now
    };

    return channelMap;
  } catch (error) {
    console.error('Failed to load channels:', error);
    throw new Error('Channel configuration unavailable');
  }
}

async function fetchStream(streamUrl) {
  try {
    // For m3u8 playlists, proxy the content
    if (streamUrl.endsWith('.m3u8')) {
      const proxyResponse = await fetch(streamUrl);
      if (!proxyResponse.ok) throw new Error('Stream unavailable');
      return {
        type: 'm3u8',
        content: await proxyResponse.text()
      };
    }
    // For direct streams, return the URL
    return {
      type: 'redirect',
      url: streamUrl
    };
  } catch (error) {
    console.error('Stream fetch error:', error);
    throw error;
  }
}

export default async function handler(req, res) {
  // Set proper headers for m3u8 content
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=60');
  
  const { id } = req.query;

  // Validate ID parameter
  if (!id || typeof id !== 'string') {
    res.status(400).json({ error: 'Valid channel ID parameter required' });
    return;
  }

  try {
    const channels = await loadChannels();
    const streamUrl = channels[id.toLowerCase()];

    if (!streamUrl) {
      // Channel not found, use fallback
      console.log(`Channel ${id} not found, using fallback stream`);
      const fallback = await fetchStream(FALLBACK_STREAM);
      if (fallback.type === 'm3u8') {
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.send(fallback.content);
      } else {
        res.redirect(307, fallback.url);
      }
      return;
    }

    // Try to fetch the requested stream
    try {
      const stream = await fetchStream(streamUrl);
      if (stream.type === 'm3u8') {
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.send(stream.content);
      } else {
        res.redirect(307, stream.url);
      }
    } catch (error) {
      // If main stream fails, use fallback
      console.log(`Stream for ${id} failed, using fallback`);
      const fallback = await fetchStream(FALLBACK_STREAM);
      if (fallback.type === 'm3u8') {
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.send(fallback.content);
      } else {
        res.redirect(307, fallback.url);
      }
    }
    
  } catch (error) {
    console.error('Stream error:', error.message);
    // Even if everything fails, try to redirect to fallback
    res.redirect(307, FALLBACK_STREAM);
  }
}
