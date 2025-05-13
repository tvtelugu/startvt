import fs from 'fs';
import path from 'path';

// Path to the channels configuration file
const CHANNELS_FILE = path.join(process.cwd(), 'channels.json');

// Read and validate channels configuration
let channels = {};
try {
  const rawData = fs.readFileSync(CHANNELS_FILE, 'utf8');
  channels = JSON.parse(rawData);
  
  // Validate channels structure
  if (!Array.isArray(channels)) {
    throw new Error('Invalid channels format - expected array');
  }
  
  // Convert to lookup map for faster access
  channels = channels.reduce((acc, channel) => {
    if (channel.Name && channel.Url) {
      acc[channel.Name.toLowerCase()] = channel.Url;
    }
    return acc;
  }, {});
} catch (error) {
  console.error('Failed to load channels:', error);
  process.exit(1);
}

export default function handler(req, res) {
  const { id } = req.query;

  // Validate ID parameter
  if (!id) {
    return res.status(400).json({ error: 'ID parameter is required' });
  }

  // Lookup channel by ID (case-insensitive)
  const channelUrl = channels[id.toLowerCase()];
  
  if (!channelUrl) {
    return res.status(404).json({ error: 'Channel not found' });
  }

  // Redirect to the actual stream URL
  return res.redirect(307, channelUrl);
}
