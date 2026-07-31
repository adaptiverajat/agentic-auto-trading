import React from 'react';

const ResearchAndAnalysis = ({ setScreen }) => {
  return (
    <div className="research-analysis">
      <h2>Research and Analysis</h2>
      <p>This is the Research and Analysis page.</p>
      <button onClick={() => setScreen('risk-manager')}>Next</button>
    </div>
  );
};

export default ResearchAndAnalysis;