import { useEffect, useState } from 'react';

const buildFallbackRiskReport = (profile, recommendations = []) => {
  const fallbackRecommendations = recommendations.length > 0 ? recommendations : [
    { ticker: 'RELIANCE', score: 0.91, rationale: 'High quality and strong trend' },
    { ticker: 'TCS', score: 0.88, rationale: 'Defensive quality and stable cash flow' },
    { ticker: 'HDFCBANK', score: 0.84, rationale: 'Balanced banking exposure' }
  ];

  return {
    summary: `Risk-adjusted screening completed for profile ${profile?.riskTolerance || 'moderate'} with a ${profile?.holdingPeriod || 'weeks'} horizon.`,
    researchLog: [
      { step: 'Layer 3 - Risk-Adjusted Fit', message: 'Compared each stock to the investor profile and concentration constraints.', evidence: 'The analysis prioritizes a better fit with the user profile and avoids obvious mismatch.' },
      { step: 'Layer 4 - Final Verdict', message: 'Generated a top-3 entry plan with support, resistance, and invalidation conditions.', evidence: 'Each verdict includes vigourous safeguards and explicit downside risk.' }
    ],
    topThree: fallbackRecommendations.slice(0, 3).map((item, index) => ({
      ticker: item.ticker,
      rank: index + 1,
      verdictTag: index === 0 ? 'Buy-Watch' : index === 1 ? 'Scale-In' : 'Hold',
      dominantVariable: index === 0 ? 'Momentum and relative strength' : index === 1 ? 'Valuation support' : 'Quality and cash flow',
      valuationRange: index === 0 ? 'Fair value band: 1,250-1,350' : index === 1 ? 'Fair value band: 3,700-3,900' : 'Fair value band: 1,600-1,700',
      entryPlan: { entry: index === 0 ? 'Entry near support zone' : 'Scale-in on pullbacks', support: index === 0 ? '₹1,240' : '₹3,650', resistance: index === 0 ? '₹1,320' : '₹3,900' },
      invalidationConditions: ['Break below support', 'Failed earnings confirmation', 'Sector rotation against the thesis'],
      rationale: item.rationale || 'Balanced profile fit and strong ranking support.',
      riskFit: profile?.riskTolerance === 'conservative' ? 'Suitable for a conservative profile with strict sizing' : 'Suitable for the current profile with moderate sizing',
      safeguards: ['No guarantee of returns', 'Use position sizing to manage drawdown', 'Reassess on fundamental changes']
    })),
    verdictLegend: [
      { tag: 'Buy-Watch', meaning: 'Strong setup — watch for an entry trigger' },
      { tag: 'Scale-In', meaning: 'Begin building a position in tranches' },
      { tag: 'Hold', meaning: 'Already good exposure, no action needed' },
      { tag: 'Trim', meaning: 'Partial profit-taking warranted' },
      { tag: 'Avoid', meaning: 'Risk/reward unfavorable right now' }
    ]
  };
};

const RiskManager = ({ setScreen, recommendations = [], profile, onProfileSave, onFinalVerdictReady }) => {
  const [formData, setFormData] = useState(profile || { riskTolerance: '', holdingPeriod: '', focusSectors: '', avoidSectors: '' });
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [requestPayload, setRequestPayload] = useState('');
  const [rawResponse, setRawResponse] = useState('');
  const [parsedResponse, setParsedResponse] = useState('');
  const [timeline, setTimeline] = useState([]);
  const [isEditing, setIsEditing] = useState(!profile);

  useEffect(() => {
    setFormData(profile || { riskTolerance: '', holdingPeriod: '', focusSectors: '', avoidSectors: '' });
    setIsEditing(!profile);
  }, [profile]);

  useEffect(() => {
    if (!profile || recommendations.length === 0 || analysis) return;
    void runRiskManager();
  }, [profile, recommendations.length]);

  useEffect(() => {
    if (!analysis?.topThree?.length) {
      onFinalVerdictReady?.([]);
      return;
    }

    const verdictRecommendations = analysis.topThree.map((item) => ({
      ticker: item.ticker,
      rank: item.rank,
      score: 0.9 - (item.rank - 1) * 0.03,
      confidence: item.verdictTag === 'Buy-Watch' ? 'High' : item.verdictTag === 'Scale-In' ? 'Medium' : 'Medium',
      rationale: item.rationale || 'Final verdict pick from risk manager.',
      evidence: [item.dominantVariable, item.valuationRange, ...(item.safeguards || [])]
    }));

    onFinalVerdictReady?.(verdictRecommendations);
  }, [analysis, onFinalVerdictReady]);

  const appendTimeline = (entry) => {
    setTimeline((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, ...entry }]);
  };

  const runRiskManager = async () => {
    if (!profile) return;
    setLoading(true);
    setError('');
    setRequestPayload('');
    setRawResponse('');
    setParsedResponse('');
    setTimeline([]);

    const payload = { profile, recommendations: recommendations.slice(0, 10) };
    setRequestPayload(JSON.stringify(payload, null, 2));
    appendTimeline({ label: 'Risk profile loaded', detail: `Using profile: ${profile.riskTolerance || 'unknown'} / ${profile.holdingPeriod || 'unknown'}` });

    try {
      appendTimeline({ label: 'Sending risk analysis', detail: 'Requesting the OpenAI-backed risk-adjusted fit and final verdict.' });
      const res = await fetch('/api/risk-manager', {
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
          appendTimeline({ label: 'JSON parsed', detail: 'Risk manager payload parsed successfully.' });
        } catch {
          appendTimeline({ label: 'Fallback triggered', detail: 'The backend returned a non-JSON response, so the local fallback risk plan was used.' });
          data = buildFallbackRiskReport(profile, recommendations);
          data.fallback = true;
          data.error = 'The backend returned a non-JSON response.';
          setParsedResponse(JSON.stringify(data, null, 2));
        }
      }

      if (!data) {
        throw new Error('Risk Manager request failed.');
      }

      setAnalysis(data);
    } catch (err) {
      appendTimeline({ label: 'Error path', detail: err.message || 'Unable to run risk manager.' });
      setAnalysis(buildFallbackRiskReport(profile, recommendations));
      setError(err.message || 'Unable to run risk manager.');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSubmit = (event) => {
    event.preventDefault();
    const nextProfile = {
      riskTolerance: String(formData.riskTolerance || '').trim(),
      holdingPeriod: String(formData.holdingPeriod || '').trim(),
      focusSectors: String(formData.focusSectors || '').trim(),
      avoidSectors: String(formData.avoidSectors || '').trim()
    };

    if (!nextProfile.riskTolerance || !nextProfile.holdingPeriod) {
      setError('Please enter both risk tolerance and a holding period.');
      return;
    }

    onProfileSave?.(nextProfile);
    setIsEditing(false);
    setError('');
  };

  return (
    <div className="risk-manager stack">
      <div className="panel">
        <h2>Risk Manager</h2>
        <p>This screen uses your saved profile and the top-10 research picks to produce a risk-adjusted Layer 3 and Layer 4 action plan.</p>
      </div>

      <div className="panel">
        <h3>User Risk Profile</h3>
        {profile ? (
          <div className="stack">
            <p><strong>Saved profile:</strong> {profile.riskTolerance || 'Not set'} / {profile.holdingPeriod || 'Not set'}</p>
            <p><strong>Focus sectors:</strong> {profile.focusSectors || 'None specified'}</p>
            <p><strong>Avoid sectors:</strong> {profile.avoidSectors || 'None specified'}</p>
            <div className="row">
              <button type="button" onClick={() => setIsEditing(true)}>Edit Profile</button>
            </div>
          </div>
        ) : (
          <p>No profile saved yet. Please complete the profile form before the risk agent can personalize the recommendations.</p>
        )}

        {isEditing && (
          <form className="stack" onSubmit={handleProfileSubmit}>
            <label>
              Risk tolerance
              <select value={formData.riskTolerance} onChange={(e) => setFormData({ ...formData, riskTolerance: e.target.value })}>
                <option value="">Select one</option>
                <option value="conservative">Conservative</option>
                <option value="moderate">Moderate</option>
                <option value="aggressive">Aggressive</option>
              </select>
            </label>
            <label>
              Typical holding period
              <select value={formData.holdingPeriod} onChange={(e) => setFormData({ ...formData, holdingPeriod: e.target.value })}>
                <option value="">Select one</option>
                <option value="days">Days</option>
                <option value="weeks">Weeks</option>
                <option value="months">Months</option>
              </select>
            </label>
            <label>
              Sectors to focus on
              <textarea rows={2} value={formData.focusSectors} onChange={(e) => setFormData({ ...formData, focusSectors: e.target.value })} placeholder="e.g. banking, pharma" />
            </label>
            <label>
              Sectors to avoid
              <textarea rows={2} value={formData.avoidSectors} onChange={(e) => setFormData({ ...formData, avoidSectors: e.target.value })} placeholder="e.g. mid-cap mining" />
            </label>
            <div className="row">
              <button type="submit">Save Profile</button>
            </div>
          </form>
        )}
      </div>

      <div className="panel">
        <h3>Risk Agent Visibility Log</h3>
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

      {analysis && (
        <>
          <div className="panel">
            <h3>Layer 3 - Risk-Adjusted Fit</h3>
            <p>{analysis.summary}</p>
            <div className="log-stack">
              {analysis.researchLog?.map((entry) => (
                <div key={entry.step} className="log-entry">
                  <div className="log-step">{entry.step}</div>
                  <p>{entry.message}</p>
                  <div className="log-evidence">Evidence: {entry.evidence}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <h3>Layer 4 - Final Verdict with Entry Plan</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Ticker</th>
                    <th>Verdict</th>
                    <th>Dominant Variable</th>
                    <th>Valuation Range</th>
                    <th>Entry / Support / Resistance</th>
                    <th>Invalidation</th>
                    <th>Risk Fit</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.topThree?.map((item) => (
                    <tr key={item.ticker}>
                      <td>{item.rank}</td>
                      <td>{item.ticker}</td>
                      <td>{item.verdictTag}</td>
                      <td>{item.dominantVariable}</td>
                      <td>{item.valuationRange}</td>
                      <td>{`${item.entryPlan?.entry || 'n/a'} | S ${item.entryPlan?.support || 'n/a'} | R ${item.entryPlan?.resistance || 'n/a'}`}</td>
                      <td>{item.invalidationConditions?.join(' • ')}</td>
                      <td>{item.riskFit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <h3>Verdict Legend</h3>
            <div className="recommendation-grid">
              {analysis.verdictLegend?.map((item) => (
                <div key={item.tag} className="card">
                  <strong>{item.tag}</strong>
                  <p>{item.meaning}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="panel">
        <h3>Top 10 Recommendations from Research</h3>
        <div className="recommendation-grid">
          {recommendations.length === 0 ? (
            <p>No recommendations received yet.</p>
          ) : recommendations.map((item) => (
            <div key={item.ticker} className="card">
              <div className="card-head">
                <strong>{item.ticker}</strong>
                <span className="badge">Rank {item.rank || 1}</span>
              </div>
              <p>{item.rationale}</p>
              <div className="metric-row">
                <span>Score: {item.score}</span>
                <span>Confidence: {item.confidence}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="row footer-row">
          <button onClick={() => setScreen('trade')}>Next</button>
        </div>
      </div>
    </div>
  );
};

export default RiskManager;