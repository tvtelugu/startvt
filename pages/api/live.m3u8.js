// pages/api/live.m3u8.js
import path from 'path';
import { promises as fs } from 'fs';

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache
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
      res.status(404).json({ error: 'Channel not found' });
      return;
    }

    // For m3u8 playlists, we might want to proxy the content
    if (streamUrl.endsWith('.m3u8')) {
      const proxyResponse = await fetch(streamUrl);
      const playlist = await proxyResponse.text();
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.send(playlist);
    } 
    // For direct streams, redirect
    else {
      res.redirect(307, streamUrl);
    }
    
  } catch (error) {
    console.error('Stream error:', error.message);
    const status = error.message.includes('unavailable') ? 503 : 500;
    res.status(status).json({ 
      error: error.message || 'Failed to process stream request' 
    });
  }
}
