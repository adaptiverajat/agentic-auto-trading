import React from 'react';

const Login = ({ onSuccess }) => {
  const handleLogin = () => {
    // Simulate a successful login
    setTimeout(() => {
      onSuccess();
    }, 1000);
  };

  return (
    <>
      <header className="nav">
        <h1>Agentic Auto Trading</h1>
        <nav>
          <button onClick={() => setScreen('login')} className={screen==='login'? 'active':''}>Login</button>
          <button onClick={() => setScreen('trade')} className={screen==='trade'? 'active':''}>Trade</button>
          <button onClick={() => setScreen('portfolio')} className={screen==='portfolio'? 'active':''}>Portfolio</button>
        </nav>
      </header>

      <main>
            <div className="login">
            <h2>Login</h2>
            <button onClick={handleLogin}>Connect to Kite</button>
            </div>
            <div className="app"></div>
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
          <div>
            <form onSubmit={handleSubmit} className="stack">
              <textarea rows={6} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
              <div className="panel">
                <h3>Order price</h3>
                <label htmlFor="price-input">Enter a limit price (leave blank to use the live quote)</label>
                <input
                  id="price-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="Limit price (0 allowed)"
                />
                {quoteError ? (
                  <p className="error"><strong>Live quote:</strong> {quoteError}</p>
                ) : livePrice ? (
                  <p><strong>Live quote:</strong> {livePrice}</p>
                ) : (
                  <p><strong>Live quote:</strong> {kiteStatus === 'Connected to Kite' ? 'Loading...' : 'Connect Kite to see live quote'}</p>
                )}
                <p><strong>Current order price:</strong> {price || 'Not set'}</p>
              </div>
              <div className="row">
                <button type="submit" disabled={loading}>{loading ? 'Thinking...' : 'Run Agent'}</button>
              </div>
            </form>

            {debugPayload && (
              <div className="panel">
                <h3>Final trade endpoint URL</h3>
                <pre className="result">{debugUrl}</pre>
              </div>
            )}
            {debugPayload && (
              <div className="panel">
                <h3>Outgoing request payload</h3>
                <pre className="result">{debugPayload}</pre>
              </div>
            )}
            {debugResponse && (
              <div className="panel">
                <h3>Backend response JSON</h3>
                <pre className="result">{debugResponse}</pre>
              </div>
            )}
            {result && <pre className="result">{result}</pre>}
            {error && <p className="error">{error}</p>}
          </div>
        )}

        {screen === 'portfolio' && (
          <div className="panel">
            <h2>Portfolio</h2>
            <p>Portfolio management dashboard (placeholder).</p>
            <p>Holdings, P&L and recent orders will appear here.</p>
          </div>
        )}
      </main>
    </>
  );
};

export default Login;