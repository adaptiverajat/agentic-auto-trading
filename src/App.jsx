import { useEffect, useState } from 'react';
import ResearchAndAnalysis from './ResearchAndAnalysis';
import RiskManager from './RiskManager';
import Trade from './Trade';

function App() {
  const [prompt, setPrompt] = useState('Buy 1 share of Reliance if the market is bullish today.');
  const [price, setPrice] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [debugPayload, setDebugPayload] = useState('');
  const [debugResponse, setDebugResponse] = useState('');
  const [debugUrl, setDebugUrl] = useState('');
  const [kiteStatus, setKiteStatus] = useState('Checking connection...');
  const [livePrice, setLivePrice] = useState('');
  const [quoteError, setQuoteError] = useState('');
  const [kiteConnectResult, setKiteConnectResult] = useState('');
  const [kiteForm, setKiteForm] = useState({
    requestToken: '',
    accessToken: ''
  });
  const [recommendedStocks, setRecommendedStocks] = useState([]);
  const [userProfile, setUserProfile] = useState(() => {
    if (typeof window === 'undefined') return null;
    try {
      const rawValue = window.localStorage.getItem('agentic-auto-trading-user-profile');
      return rawValue ? JSON.parse(rawValue) : null;
    } catch {
      return null;
    }
  });

  const [screen, setScreen] = useState('login'); // login | trade | portfolio

  const parseApiResponse = async (response) => {
    const text = await response.text();
    if (!text) return {};

    try {
      return JSON.parse(text);
    } catch {
      throw new Error(
        'The server returned an unexpected response. Make sure the backend is running on port 3101 and try again.'
      );
    }
  };

  const loadKiteStatus = async () => {
    try {
      const res = await fetch('/api/kite/status');
      const data = await parseApiResponse(res);
      setKiteStatus(data.connected ? 'Connected to Kite' : 'Not connected to Kite');
    } catch {
      setKiteStatus('Unable to check status');
    }
  };

  const fetchLivePrice = async () => {
    try {
      setQuoteError('');
      const res = await fetch('/api/quote?symbol=RELIANCE');
      const data = await parseApiResponse(res);
      if (!res.ok) throw new Error(data.error || 'Unable to fetch quote');
      if (data?.price) {
        setLivePrice(data.price);
      } else {
        setLivePrice('');
      }
    } catch (err) {
      setLivePrice('');
      setQuoteError(err.message || 'Unable to fetch quote');
    }
  };

  useEffect(() => {
    const init = async () => {
      await loadKiteStatus();
      await fetchLivePrice();
    };

    init();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (userProfile) {
      window.localStorage.setItem('agentic-auto-trading-user-profile', JSON.stringify(userProfile));
    } else {
      window.localStorage.removeItem('agentic-auto-trading-user-profile');
    }
  }, [userProfile]);

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data?.type !== 'kite-auth-success') return;
      const requestToken = event.data.requestToken || '';
      setKiteForm((prev) => ({ ...prev, requestToken }));
      if (requestToken) {
        setKiteStatus('Kite login complete');
        setResult(JSON.stringify({ requestToken }, null, 2));
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleLoginUrl = async () => {
    setError('');
    try {
      const res = await fetch('/api/kite/login-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await parseApiResponse(res);
      if (!res.ok) throw new Error(data.error || 'Could not create login URL');
      window.open(data.loginUrl, '_blank', 'noopener,noreferrer');
      setResult(JSON.stringify({ loginUrl: data.loginUrl }, null, 2));
    } catch (err) {
      setError(err.message || 'Unable to open Kite login');
    }
  };

  const handleKiteConnect = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/kite/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(kiteForm)
      });
      const data = await parseApiResponse(res);
      if (!res.ok) throw new Error(data.error || 'Connection failed');
      setKiteStatus('Connected to Kite');
      await fetchLivePrice();
      setKiteConnectResult('Connected to Kite successfully');
      setResult('');
      setTimeout(() => setScreen('research'), 1000);
    } catch (err) {
      setError(err.message || 'Unable to connect to Kite');
      setKiteConnectResult(`Connection failed: ${err.message || 'Unable to connect to Kite'}`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult('');
    setDebugPayload('');
    setDebugResponse('');
    setDebugUrl('');

    const payload = { prompt, price: price ? Number(price) : null };
    setDebugPayload(JSON.stringify(payload, null, 2));
    setDebugUrl(new URL('/api/trade', window.location.origin).toString());

    try {
      const res = await fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await parseApiResponse(res);
      setDebugResponse(JSON.stringify(data, null, 2));
      if (!res.ok) throw new Error(data.error || 'Request failed');
      setResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleRecommendationsReady = (items) => {
    setRecommendedStocks(items || []);
  };

  const handleProfileSave = (profile) => {
    setUserProfile(profile);
  };

  return (
    <div className="app">
      <header className="nav">
        <h1>Agentic Auto Trading</h1>
        <nav>
          <button onClick={() => setScreen('login')} className={screen==='login'? 'active':''}>Login</button> &nbsp;&gt;&gt;&nbsp;
          <button onClick={() => setScreen('research')} className={screen==='research'? 'active':''}>Research</button> &nbsp;&gt;&gt;&nbsp;
          <button onClick={() => setScreen('risk-manager')} className={screen==='risk-manager'? 'active':''}>Risk Manager</button> &nbsp;&gt;&gt;&nbsp;
          <button onClick={() => setScreen('trade')} className={screen==='trade'? 'active':''}>Trade</button>
          <button onClick={() => setScreen('portfolio')} className={screen==='portfolio'? 'active':''}>Portfolio</button>
        </nav>
      </header>

      <main>
        {screen === 'login' && (
          <div className="panel">
            <h2>Kite Connect</h2>
            <p>Status: {kiteStatus}</p>
            <form onSubmit={handleKiteConnect} className="stack">
              <div className="row">
                <button type="button" onClick={handleLoginUrl}>Open Kite Login</button>
                <button type="submit">Connect Kite</button>
              </div>
            </form>
            {error && <p className="error">{error}</p>}
            {kiteConnectResult && (
              <div className="panel">
                <h3>Connect response</h3>
                <pre className="result">{kiteConnectResult}</pre>
              </div>
            )}
          </div>
        )}

        {screen === 'trade' && (
          <Trade recommendations={recommendedStocks} />
        )}

        {screen === 'portfolio' && (
          <div className="panel">
            <h2>Portfolio</h2>
            <p>Portfolio management dashboard (placeholder).</p>
            <p>Holdings, P&L and recent orders will appear here.</p>
          </div>
        )}

        {screen === 'research' && (
          <ResearchAndAnalysis setScreen={setScreen} onRecommendationsReady={handleRecommendationsReady} />
        )}
        {screen === 'risk-manager' && (
          <RiskManager
            setScreen={setScreen}
            recommendations={recommendedStocks}
            profile={userProfile}
            onProfileSave={handleProfileSave}
          />
        )}
      </main>
    </div>
  );
}

export default App;