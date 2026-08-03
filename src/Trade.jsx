import { useMemo, useState } from 'react';

const Trade = ({ recommendations = [] }) => {
  const tradeCandidates = useMemo(() => (recommendations || []).slice(0, 5), [recommendations]);
  const [quantities, setQuantities] = useState({});
  const [buyingTicker, setBuyingTicker] = useState('');
  const [tradeLog, setTradeLog] = useState([]);
  const [error, setError] = useState('');

  const getSuggestedUnits = (index) => Math.max(1, Math.min(5, 6 - index));

  const handleQuantityChange = (ticker, value) => {
    setQuantities((prev) => ({ ...prev, [ticker]: value }));
  };

  const handleBuy = async (candidate) => {
    const quantity = Number(quantities[candidate.ticker] ?? getSuggestedUnits(tradeCandidates.findIndex((item) => item.ticker === candidate.ticker)));
    const normalizedQuantity = Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1;

    setBuyingTicker(candidate.ticker);
    setError('');

    try {
      const response = await fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Buy ${normalizedQuantity} unit(s) of ${candidate.ticker}`,
          symbol: candidate.ticker,
          quantity: normalizedQuantity,
          side: 'BUY'
        })
      });

      const rawBody = await response.text();
      let parsed = null;
      try {
        parsed = rawBody ? JSON.parse(rawBody) : null;
      } catch {
        parsed = { raw: rawBody };
      }

      const detailPayload = {
        message: parsed?.message || parsed?.reply || null,
        error_type: parsed?.error_type || parsed?.errorType || null,
        response: parsed?.order || parsed
      };

      const detail = JSON.stringify(detailPayload, null, 2);

      setTradeLog((prev) => [
        {
          id: `${candidate.ticker}-${Date.now()}`,
          ticker: candidate.ticker,
          status: response.ok ? 'Executed' : 'Failed',
          detail
        },
        ...prev
      ]);

      if (!response.ok) {
        setError(parsed?.error || 'Trade request failed');
      }
    } catch (err) {
      setTradeLog((prev) => [
        {
          id: `${candidate.ticker}-${Date.now()}-error`,
          ticker: candidate.ticker,
          status: 'Failed',
          detail: err.message || 'Unable to place trade'
        },
        ...prev
      ]);
      setError(err.message || 'Unable to place trade');
    } finally {
      setBuyingTicker('');
    }
  };

  return (
    <div className="trade stack">
      <div className="panel">
        <h2>Trade</h2>
        <p>Review the final top-5 picks from the research and risk-manager workflow, adjust the unit size, and place a buy order for each decision.</p>
      </div>

      <div className="panel">
        <h3>Top 5 Recommended Stocks</h3>
        {tradeCandidates.length === 0 ? (
          <p>No trade candidates available yet. Complete the research flow first.</p>
        ) : (
          <div className="table-wrap">
            <table className="trade-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Ticker</th>
                  <th>Reason</th>
                  <th>Suggested Units</th>
                  <th>Units to Buy</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {tradeCandidates.map((candidate, index) => {
                  const suggestedUnits = getSuggestedUnits(index);
                  const selectedUnits = quantities[candidate.ticker] ?? suggestedUnits;
                  return (
                    <tr key={candidate.ticker}>
                      <td>{index + 1}</td>
                      <td>{candidate.ticker}</td>
                      <td>{candidate.rationale || 'No rationale provided'}</td>
                      <td>{suggestedUnits}</td>
                      <td>
                        <input
                          className="trade-quantity"
                          type="number"
                          min="1"
                          step="1"
                          value={selectedUnits}
                          onChange={(event) => handleQuantityChange(candidate.ticker, event.target.value)}
                        />
                      </td>
                      <td>
                        <button type="button" onClick={() => handleBuy(candidate)} disabled={buyingTicker === candidate.ticker}>
                          {buyingTicker === candidate.ticker ? 'Buying...' : 'Buy'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel">
        <h3>Trade Activity Log</h3>
        {error && <p className="error">{error}</p>}
        {tradeLog.length === 0 ? (
          <p>No trades executed yet.</p>
        ) : (
          <div className="trade-log stack">
            {tradeLog.map((entry) => (
              <div key={entry.id} className="card">
                <div className="card-head">
                  <strong>{entry.ticker}</strong>
                  <span className="badge">{entry.status}</span>
                </div>
                <pre className="result trade-log-detail">{entry.detail}</pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Trade;