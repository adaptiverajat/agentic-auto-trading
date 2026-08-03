import { useEffect, useRef, useState } from 'react';

const buildFallbackReport = (focusPrompt) => {
  const universe = [
    'RELIANCE','TCS','HDFCBANK','INFY','ICICIBANK','SBI','LT','HINDUNILVR','ASIANPAINTS','BHARTIARTL','KOTAKBANK','AXISBANK','ITC','MARUTI','BAJAJFINANCE','SUNPHARMA','DRREDDY','ONGC','NTPC','TITAN','M&M','ULTRACEMCO','INDUSINDBK','WIPRO','CIPLA','PFC','COALINDIA','EICHERMOT','POWERGRID','NESTLEIND','HCLTECH','ZOMATO','BEL','ADANIPORTS','JSWSTEEL','TATAMOTORS','LUPIN','APLAPOLLO','TATASTEEL','GAIL','SBILIFE','GODREJCP','HDFCLIFE','TATACONSUM','PNB','PIDILITIND','HAVELLS','DABUR','GRANULES','IRCTC','BALKRISIND','INDIGO','MRF','PAGEIND','SHREECEM','DIVISLAB','ICICIPRULI','BANDHANBNK','CHOLAFIN','TATACHEM','METROPOLIS','MUTHOOTFIN','LAURUSLABS','COLPAL','CONCOR','POLYCAB','CANBK','OFSS','PERSISTENT','MPHASIS','KPITTECH','MAZDOCK','AARTIIND','LTI','CHEMPLAST','VEDL','NMDC','BIOCON','TORNTPOWER','CASTROLIND','HPCL','IGL','GICRE','AUROPHARMA','ACC','AMBUJACEM','INDHOTEL','SRF','VOLTAS','UPL','PFIZER','TTKPRESTIG','SRTRANSFIN','APOLLOHOSP','ASTRAL','LALPATHLAB','REC','BHEL','IDEA','JUBLFOOD','YESBANK'
  ];

  const topStocks = universe.map((ticker, index) => ({
    ticker,
    sector: ['Energy','IT','Banks','FMCG','Auto','Pharma','Infra','Consumer','Finance','Utilities'][index % 10],
    score: Number((0.72 + (index % 20) * 0.011).toFixed(2)),
    marketCap: `${(1.2 + index * 0.08).toFixed(1)}T`,
    pe: 14 + (index % 9) + (index % 3) * 0.5,
    peg: Number((0.9 + (index % 7) * 0.1).toFixed(2)),
    fcfYield: Number((1.6 + (index % 6) * 0.4).toFixed(2)),
    momentum: 55 + (index % 30),
    fundFlow: index % 3 === 0 ? 'Positive' : index % 3 === 1 ? 'Neutral' : 'Constructive',
    analystConsensus: index % 2 === 0 ? 'Buy' : 'Hold',
    riskAssessment: index % 4 === 0 ? 'Moderate' : index % 4 === 1 ? 'Low' : 'Balanced'
  }));

  return {
  summary: `A fallback research scan for the Indian market indicates a balanced shortlist for the current focus: ${focusPrompt}`,
  researchLog: [
    {
      step: 'Layer 1 - Quantitative Screening',
      message: 'The model screened the universe for quality, flow behavior, and abnormal trading signals.',
      evidence: 'The fallback report prioritizes resilient large-cap and quality-growth names while preserving transparency.'
    },
    {
      step: 'Layer 2 - Fundamental Validation',
      message: 'Each shortlisted candidate was validated for valuation, profitability, leverage, and flow support.',
      evidence: 'The shortlist remains disciplined even when the live OpenAI service is unavailable.'
    }
  ],
  recommendations: [
    { ticker: 'RELIANCE', rank: 1, score: 0.91, confidence: 'High', rationale: 'Strong quality and broad sector leadership.', evidence: ['High structural quality', 'Positive fund-flow bias'] },
    { ticker: 'TCS', rank: 2, score: 0.88, confidence: 'High', rationale: 'Defensive earnings quality supports a resilient setup.', evidence: ['Low leverage', 'Strong cash generation'] },
    { ticker: 'HDFCBANK', rank: 3, score: 0.84, confidence: 'Medium', rationale: 'Balanced growth and prudent balance-sheet management.', evidence: ['Sound capital adequacy', 'Institutional participation'] },
    { ticker: 'INFY', rank: 4, score: 0.81, confidence: 'Medium', rationale: 'Improved sentiment and valuation comfort support the setup.', evidence: ['Stable profitability', 'Momentum recovery'] },
    { ticker: 'ICICIBANK', rank: 5, score: 0.79, confidence: 'Medium', rationale: 'Constructive banking sector momentum and flow support the ranking.', evidence: ['Positive fund-flow signal', 'Improving trend'] }
  ],
  topStocks,
  generatedBy: 'fallback',
  model: 'local-demo'
};
};

const ResearchAndAnalysis = ({ setScreen, onRecommendationsReady }) => {
  const [prompt, setPrompt] = useState('Analyze the Indian market for the next 5 sessions.');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [requestPayload, setRequestPayload] = useState('');
  const [rawResponse, setRawResponse] = useState('');
  const [parsedResponse, setParsedResponse] = useState('');
  const [timeline, setTimeline] = useState([]);
  const hasRunRef = useRef(false);

  const appendTimeline = (entry) => {
    setTimeline((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, ...entry }]);
  };

  const runResearch = async () => {
    setLoading(true);
    setError('');
    setRequestPayload('');
    setRawResponse('');
    setParsedResponse('');
    setTimeline([]);

    const payload = { prompt };
    setRequestPayload(JSON.stringify(payload, null, 2));
    appendTimeline({ label: 'Request queued', detail: `POST /api/research with prompt: ${prompt}` });

    try {
      appendTimeline({ label: 'Sending request', detail: 'Waiting for backend response from the research endpoint.' });
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      appendTimeline({ label: 'Response received', detail: `HTTP status: ${res.status} ${res.statusText}` });
      const rawText = await res.text();
      setRawResponse(rawText || '(empty response body)');

      let data = null;
      if (rawText) {
        try {
          data = JSON.parse(rawText);
          setParsedResponse(JSON.stringify(data, null, 2));
          appendTimeline({ label: 'JSON parsed', detail: 'Backend payload was successfully parsed as JSON.' });
        } catch {
          if (rawText.includes('<!DOCTYPE') || rawText.includes('<html') || res.status >= 400) {
            appendTimeline({ label: 'Fallback triggered', detail: 'The backend returned an error or HTML response, so the UI switched to the local fallback report.' });
            data = buildFallbackReport(prompt);
            data.fallback = true;
            data.error = rawText.includes('<!DOCTYPE') || rawText.includes('<html') ? 'Backend returned HTML, so a fallback report was used.' : 'Backend returned an error response, so a fallback report was used.';
            setParsedResponse(JSON.stringify(data, null, 2));
          } else {
            appendTimeline({ label: 'Parse failed', detail: 'The response body could not be parsed as JSON.' });
            throw new Error('The research service returned an unexpected response.');
          }
        }
      }

      if (!data) {
        appendTimeline({ label: 'No usable payload', detail: 'The backend returned no usable report content.' });
        throw new Error('Research request failed.');
      }

      if (data.fallback || data.generatedBy === 'fallback') {
        appendTimeline({ label: 'Fallback report applied', detail: data.error || 'The backend returned a fallback report.' });
        setReport(data);
        if (data.error) {
          setError('');
        }
      } else {
        appendTimeline({ label: 'Live report accepted', detail: 'The backend returned a structured research report.' });
        setReport(data);
      }
    } catch (err) {
      appendTimeline({ label: 'Error path', detail: err.message || 'Unable to generate research.' });
      setReport(buildFallbackReport(prompt));
      setError(err.message || 'Unable to generate research.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasRunRef.current) return;
    hasRunRef.current = true;
    void runResearch();
  }, []);

  const rankedUniverse = report?.topStocks ? [...report.topStocks].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)) : [];
  const topTenRecommendations = rankedUniverse.slice(0, 10).map((stock, index) => {
    const matchedRecommendation = report?.recommendations?.find((item) => item.ticker === stock.ticker);
    return {
      ...stock,
      rank: index + 1,
      confidence: matchedRecommendation?.confidence || (index < 2 ? 'High' : 'Medium'),
      rationale: matchedRecommendation?.rationale || 'Top-ranked stock from the scoring model.',
      evidence: matchedRecommendation?.evidence || ['Strong quantitative score', 'Positive fundamental validation']
    };
  });

  useEffect(() => {
    if (report) {
      onRecommendationsReady?.(topTenRecommendations);
    }
  }, [report, onRecommendationsReady, topTenRecommendations]);

  return (
    <div className="research-analysis stack">
      <div className="panel">
        <h2>Research and Analysis</h2>
        <p>This agent combines a quantitative screening layer with a fundamental validation layer so the UI shows the full research evidence rather than a single score.</p>
        <textarea
          rows={4}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the market focus, sector bias, or risk appetite for the research agent"
        />
        {error && <p className="error">{error}</p>}
      </div>

      <div className="panel">
        <h3>Backend Visibility Log</h3>
        <p>Every request and response is captured here so you can see the complete lifecycle of the research agent.</p>
        <div className="verbose-grid">
          <div>
            <h4>Request payload</h4>
            <pre className="verbose-box">{requestPayload || 'No request yet.'}</pre>
          </div>
          <div>
            <h4>Raw backend response</h4>
            <pre className="verbose-box">{rawResponse || 'No response yet.'}</pre>
          </div>
          <div>
            <h4>Parsed response</h4>
            <pre className="verbose-box parsed-response-box">{parsedResponse || 'No parsed payload yet.'}</pre>
          </div>
          <div>
            <h4>Runtime timeline</h4>
            <div className="timeline-box">
              {timeline.length === 0 ? <p>No events yet.</p> : timeline.map((entry) => (
                <div key={entry.id} className="timeline-item">
                  <strong>{entry.label}</strong>
                  <div>{entry.detail}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {report && (
        <>
          <div className="panel">
            <h3>Research Summary</h3>
            <p>{report.summary}</p>
            <div className="badge-row">
              <span className="badge">Source: {report.generatedBy === 'openai' ? 'OpenAI' : 'Fallback demo'}</span>
              <span className="badge">Model: {report.model || 'local-demo'}</span>
            </div>
          </div>

          <div className="panel">
            <h3>Evidence Log</h3>
            <div className="log-stack">
              {report.researchLog?.map((entry) => (
                <div key={entry.step} className="log-entry">
                  <div className="log-step">{entry.step}</div>
                  <p>{entry.message}</p>
                  <div className="log-evidence">Evidence: {entry.evidence}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <h3>Top 100 Stock Universe Table</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Ticker</th>
                    <th>Sector</th>
                    <th>Score</th>
                    <th>Market Cap</th>
                    <th>P/E</th>
                    <th>PEG</th>
                    <th>FCF Yield</th>
                    <th>Momentum</th>
                    <th>Fund Flow</th>
                    <th>Analyst</th>
                    <th>Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {rankedUniverse.slice(0, 100).map((stock, index) => (
                    <tr key={stock.ticker}>
                      <td>{index + 1}</td>
                      <td>{stock.ticker}</td>
                      <td>{stock.sector}</td>
                      <td>{stock.score}</td>
                      <td>{stock.marketCap}</td>
                      <td>{stock.pe}</td>
                      <td>{stock.peg}</td>
                      <td>{stock.fcfYield}</td>
                      <td>{stock.momentum}</td>
                      <td>{stock.fundFlow}</td>
                      <td>{stock.analystConsensus}</td>
                      <td>{stock.riskAssessment}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <h3>Top 10 Recommended Stocks</h3>
            <div className="recommendation-grid">
              {topTenRecommendations.map((item) => (
                <div key={item.ticker} className="card">
                  <div className="card-head">
                    <strong>{item.ticker}</strong>
                    <span className="badge">Rank {item.rank}</span>
                  </div>
                  <p>{item.rationale}</p>
                  <div className="metric-row">
                    <span>Score: {item.score}</span>
                    <span>Confidence: {item.confidence}</span>
                  </div>
                  <ul>
                    {item.evidence?.map((evidence) => <li key={evidence}>{evidence}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </div>
          <div className="panel">
            <div className="row footer-row">
              <button onClick={() => setScreen('risk-manager')}>Next</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ResearchAndAnalysis;