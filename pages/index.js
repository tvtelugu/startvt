import { useState } from 'react';

export default function StreamPlayer() {
  const [state, setState] = useState({
    id: '',
    type: 'live',
    error: '',
    loading: false
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!state.id.trim()) return;
    
    setState({...state, loading: true, error: ''});

    try {
      const res = await fetch(`/api/${state.type}?id=${encodeURIComponent(state.id)}`);
      
      if (res.redirected) {
        window.open(res.url, '_blank');
      } else {
        const { error } = await res.json();
        setState({...state, error: error || 'Failed to load stream', loading: false});
      }
    } catch (err) {
      setState({...state, error: 'Network error', loading: false});
    }
  };

  return (
    <div className="container">
      <h1>Streaming Proxy</h1>
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Content Type</label>
          <select 
            value={state.type}
            onChange={(e) => setState({...state, type: e.target.value})}
            disabled={state.loading}
          >
            {['live', 'movies', 'series'].map(type => (
              <option key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Stream ID</label>
          <input
            type="text"
            value={state.id}
            onChange={(e) => setState({...state, id: e.target.value})}
            placeholder="Enter stream ID"
            disabled={state.loading}
          />
        </div>

        <button type="submit" disabled={state.loading || !state.id.trim()}>
          {state.loading ? 'Loading...' : 'Play Stream'}
        </button>

        {state.error && <div className="error">{state.error}</div>}
      </form>

      <style jsx>{`
        .container {
          max-width: 600px;
          margin: 2rem auto;
          padding: 1rem;
        }
        .form-group {
          margin-bottom: 1rem;
        }
        label {
          display: block;
          margin-bottom: 0.5rem;
        }
        select, input {
          width: 100%;
          padding: 0.5rem;
        }
        button {
          padding: 0.5rem 1rem;
          background: #0070f3;
          color: white;
          border: none;
        }
        button:disabled {
          background: #ccc;
        }
        .error {
          color: red;
          margin-top: 1rem;
        }
      `}</style>
    </div>
  );
}
