import React, { useState, useEffect } from 'react';
import Head from 'next/head';

export default function Home() {
  const [customCode, setCustomCode] = useState('');
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [selectedPlaylist, setSelectedPlaylist] = useState('m3u');
  const [errorMessage, setErrorMessage] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [deviceLimit, setDeviceLimit] = useState(0);
  const [allowAdultContent, setAllowAdultContent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const fetchTokens = async () => {
    try {
      const response = await fetch('/token.json');
      const data = await response.json();
      return data || [];
    } catch (error) {
      console.error('Error fetching tokens:', error);
      return [];
    }
  };

  const isTokenValid = (token, tokens) => {
    const tokenData = tokens.find(item => item.token === token);

    if (!tokenData) {
      return { isValid: false, message: 'Invalid token', data: null };
    }

    const currentDate = new Date();
    const expiresAt = new Date(tokenData.expiresAt);

    if (currentDate > expiresAt) {
      return { isValid: false, message: 'Token has expired', data: null };
    }

    return { isValid: true, message: '', data: tokenData };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const tokens = await fetchTokens();

    const { isValid, message, data } = isTokenValid(customCode, tokens);

    if (!isValid) {
      setErrorMessage(message);
      setPlaylistUrl('');
      setExpiryDate('');
      setDeviceLimit(0);
      setAllowAdultContent(false);
      setCountdown(0);
      return;
    }

    setErrorMessage('');
    setExpiryDate(data.expiresAt);
    setDeviceLimit(data.deviceLimit);
    setAllowAdultContent(data.allowAdultContent);

    const m3uUrl = "https://tvtelugu.vercel.app/api/m3u";
    const portalUrl = "https://tvtelugu.vercel.app/api/portal";
    const generatedUrl = selectedPlaylist === 'm3u' 
      ? `${m3uUrl}?token=${customCode}` 
      : `${portalUrl}?token=${customCode}`;

    setPlaylistUrl(generatedUrl);

    const currentDate = new Date();
    const expiresAt = new Date(data.expiresAt);
    const timeRemaining = Math.max(0, expiresAt - currentDate);
    setCountdown(timeRemaining);

    const intervalId = setInterval(() => {
      setCountdown(prev => Math.max(0, prev - 1000));
    }, 1000);

    return () => clearInterval(intervalId);
  };

  const copyToClipboard = () => {
    if (playlistUrl) {
      navigator.clipboard.writeText(playlistUrl)
        .then(() => {
          alert('Playlist URL copied to clipboard!');
        })
        .catch((err) => {
          console.error('Could not copy text: ', err);
        });
    }
  };

  const formatTime = (time) => {
    const seconds = Math.floor((time / 1000) % 60);
    const minutes = Math.floor((time / 1000 / 60) % 60);
    const hours = Math.floor((time / 1000 / 60 / 60) % 24);
    const days = Math.floor(time / 1000 / 60 / 60 / 24);
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '5px',
      position: 'relative',
      overflow: 'hidden',
      backgroundImage: 'url("https://images.pexels.com/photos/4840134/pexels-photo-4840134.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1")',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }}>
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(5px)',
        zIndex: 0,
      }}></div>

      <Head>
        <title>🕊𝐓𝐕𝐓𝐞𝐥𝐮𝐠𝐮™</title>
        <link rel="icon" href="https://tvtelugu.github.io/images/tvtelugu.ico" />
        <link rel="stylesheet" href="https://tvtelugu-tp.vercel.app/style.css" />
      </Head>

      <a href="https://tvtelugu.vercel.app" style={{ margin: '5px 0', zIndex: 1 }}>
        <img src="https://tvtelugu.github.io/images/tvtelugu.png" alt="Logo" style={{ width: '200px', height: 'auto' }} />
      </a>

      <div style={{
        marginTop: '20px',
        marginBottom: '20px', 
        padding: '2px',
        background: '#000000',
        border: '3px solid #f30000',
        borderRadius: '8px',
        textAlign: 'center',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
        zIndex: 1,
        color: '#fff',
        width: '80%',
        maxWidth: '500px',
      }}>
        <p style={{ fontStyle: 'italic' }}>
          "Before generating your playlist, apply your personal token below."
        </p>
        <a href="https://t.me/tvtelugu" style={{ color: '#fff', textDecoration: 'underline' }}>Contact us on Telegram</a>
      </div>

      <form onSubmit={handleSubmit} style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        width: '100%',
        maxWidth: '400px',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
        zIndex: 1,
      }}>
        <input
          type="text"
          value={customCode}
          onChange={(e) => setCustomCode(e.target.value)}
          placeholder="Enter your Token code"
          required
          style={{
            padding: '10px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontSize: '1rem',
          }}
        />
        <select 
          value={selectedPlaylist} 
          onChange={(e) => setSelectedPlaylist(e.target.value)} 
          style={{
            padding: '10px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontSize: '1rem',
          }}
        >
          <option value="m3u">M3U Playlist</option>
          <option value="portal">Portal Playlist</option>
        </select>
        <button type="submit" style={{
          padding: '10px',
          backgroundColor: '#0070f3',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontWeight: 'bold',
        }}>Generate</button>
      </form>

      {errorMessage && (
        <div style={{ marginTop: '5px', color: 'red', zIndex: 1 }}>
          {errorMessage}
        </div>
      )}

      {playlistUrl && (
        <div style={{ marginTop: '5px', fontSize: '1rem', color: '#fff', zIndex: 1, textAlign: 'center' }}>
          <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            Playlist Generated Successfully, Copy Your Playlist Below:
            <span style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '10px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '2px solid #0070f3',
              borderRadius: '8px',
              width: '250px',
              boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
              transition: 'background 0.3s, transform 0.3s',
              marginLeft: '10px',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}>
              <button 
                onClick={copyToClipboard} 
                style={{
                  marginLeft: '10px',
                  padding: '10px 30px', 
                  background: 'linear-gradient(45deg, #00c853, #1b5e20)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  boxShadow: '0 4px 10px rgba(0, 0, 0, 0.2)',
                  transition: 'transform 0.2s, box-shadow 0.2s, background 0.3s',
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'scale(1.1)';
                  e.target.style.background = 'linear-gradient(45deg, #1b5e20, #00c853)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'scale(1)';
                  e.target.style.background = 'linear-gradient(45deg, #00c853, #1b5e20)';
                }}
              >
                Copy
              </button>
            </span>
          </p>
          <p style={{ color: '#fff', fontStyle: 'italic', marginTop: '2px' }}>
            ⚠️ Note: Generated Playlist works only on OTT Navigator and Tivimate players. If it's not loading, check your internet connection and refresh 3 to 4 times.
          </p>
        </div>
      )}

      {countdown > 0 && (
        <div style={{ marginTop: '2px', color: '#fff', zIndex: 1 }}>
          <p style={{ fontWeight: 'bold' }}>Expires in: {formatTime(countdown)}</p>
        </div>
      )}

      {playlistUrl && (
        <div style={{ marginTop: '2px', color: '#fff', zIndex: 1, textAlign: 'center' }}>
          <div style={{
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.5)',
            padding: '10px',
            borderRadius: '8px',
            background: 'rgba(255, 255, 255, 0.1)',
            zIndex: 1,
          }}>
            <p style={{ fontWeight: 'bold' }}>Expiry Date: {new Date(expiryDate).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
            <p style={{ fontWeight: 'bold' }}>Device Limit: {deviceLimit}</p>
            <p style={{ fontWeight: 'bold', color: allowAdultContent ? 'green' : 'red' }}> 🔞 Adult Content: {allowAdultContent ? 'Subscribed' : 'subscription Not Found'}</p>
          </div>
        </div>
      )}

      <footer style={{
        position: 'relative',
        bottom: 0,
        left: 0,
        right: 0,
        textAlign: 'center',
        padding: '10px',
        color: '#fff',
        zIndex: 1,
        marginTop: '20px',
      }}>
        <p> © 2024 🕊𝐓𝐕𝐓𝐞𝐥𝐮𝐠𝐮™. All Rights Reserved. </p>
        <p>⚠️ Disclaimer: The playlist generated on TVTelugu is for personal use only. We do not host content. Use responsibly. </p>
      </footer>
    </div>
  );
}
