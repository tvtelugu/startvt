import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import axios from 'axios';

export default function Home() {
  const [customCode, setCustomCode] = useState('');
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [selectedPlaylist, setSelectedPlaylist] = useState('m3u');
  const [errorMessage, setErrorMessage] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [deviceLimit, setDeviceLimit] = useState(0);
  const [allowAdultContent, setAllowAdultContent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [activeDevices, setActiveDevices] = useState(0);
  const [loading, setLoading] = useState(false);

  // Load configuration (would typically come from an API in a real app)
  const config = {
    baseUrl: '',
    username: '',
    password: '',
    paths: {
      live: '/live',
      movies: '/movies',
      series: '/series'
    }
  };

  // Session simulation with useEffect
  useEffect(() => {
    const storedDevices = localStorage.getItem('active_devices');
    if (storedDevices) {
      setActiveDevices(parseInt(storedDevices));
    }
  }, []);

  const checkDeviceLimit = () => {
    if (activeDevices >= 20) {
      setErrorMessage("Maximum number of devices reached");
      return false;
    }
    return true;
  };

  const extractDomain = async (fullUrl) => {
    try {
      const response = await axios({
        method: 'get',
        url: fullUrl,
        headers: {
          'Icy-MetaData': '1',
          'Accept-Encoding': 'identity',
          'Host': new URL(config.baseUrl).hostname,
          'Connection': 'Keep-Alive',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Authorization': `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`
        },
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400
      });
    } catch (error) {
      if (error.response?.status === 302) {
        return error.response.headers.location;
      }
      console.error(`Error extracting domain:`, error.message);
      return false;
    }
    return false;
  };

  const handleStreamRequest = async (type, id) => {
    if (!checkDeviceLimit()) return null;

    setLoading(true);
    setErrorMessage('');

    try {
      const contentPath = config.paths[type];
      const fullUrl = `${config.baseUrl}${contentPath}/${id}.${type === 'live' ? 'ts' : 'mp4'}`;
      const domain = await extractDomain(fullUrl);

      if (!domain) {
        setErrorMessage("Unable to retrieve streaming URL");
        return null;
      }

      // Update device count
      const newCount = activeDevices + 1;
      setActiveDevices(newCount);
      localStorage.setItem('active_devices', newCount.toString());

      return domain;
    } catch (error) {
      console.error(`${type} endpoint error:`, error);
      setErrorMessage("Internal server error");
      return null;
    } finally {
      setLoading(false);
    }
  };

  const generatePlaylist = async () => {
    if (!customCode) {
      setErrorMessage("Custom code is required");
      return;
    }

    const streamUrl = await handleStreamRequest(selectedPlaylist, customCode);
    if (streamUrl) {
      setPlaylistUrl(streamUrl);
    }
  };

  return (
    <div className="container">
      <Head>
        <title>Streaming Proxy</title>
        <meta name="description" content="Generate streaming playlists" />
      </Head>

      <main>
        <h1>Streaming Proxy</h1>

        <div className="form-group">
          <label>Content Type:</label>
          <select 
            value={selectedPlaylist} 
            onChange={(e) => setSelectedPlaylist(e.target.value)}
          >
            <option value="live">Live TV</option>
            <option value="movies">Movies</option>
            <option value="series">Series</option>
          </select>
        </div>

        <div className="form-group">
          <label>Custom Code:</label>
          <input
            type="text"
            value={customCode}
            onChange={(e) => setCustomCode(e.target.value)}
            placeholder="Enter stream ID"
          />
        </div>

        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={allowAdultContent}
              onChange={(e) => setAllowAdultContent(e.target.checked)}
            />
            Allow Adult Content
          </label>
        </div>

        <button onClick={generatePlaylist} disabled={loading}>
          {loading ? 'Generating...' : 'Generate Playlist'}
        </button>

        {errorMessage && <div className="error">{errorMessage}</div>}

        {playlistUrl && (
          <div className="result">
            <h3>Your Playlist URL:</h3>
            <a href={playlistUrl} target="_blank" rel="noopener noreferrer">
              {playlistUrl}
            </a>
            <p>Active devices: {activeDevices}/20</p>
          </div>
        )}
      </main>

      <style jsx>{`
        .container {
          min-height: 100vh;
          padding: 0 2rem;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
        }
        main {
          padding: 5rem 0;
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          max-width: 800px;
          width: 100%;
        }
        .form-group {
          margin: 1rem 0;
          width: 100%;
        }
        label {
          display: block;
          margin-bottom: 0.5rem;
        }
        input, select {
          width: 100%;
          padding: 0.5rem;
          font-size: 1rem;
        }
        button {
          padding: 0.75rem 1.5rem;
          background: #0070f3;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 1rem;
          margin-top: 1rem;
        }
        button:disabled {
          background: #ccc;
          cursor: not-allowed;
        }
        .error {
          color: red;
          margin-top: 1rem;
        }
        .result {
          margin-top: 2rem;
          padding: 1rem;
          border: 1px solid #ddd;
          border-radius: 4px;
          width: 100%;
        }
      `}</style>
    </div>
  );
}
