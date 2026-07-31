import React from 'react';

const RiskManager = ({ setScreen }) => {
  return (
    <div className="risk-manager">
      <h2>Risk Manager</h2>
      <p>This is the Risk Manager page.</p>
      <button onClick={() => setScreen('trade')}>Next</button>
    </div>
  );
};

export default RiskManager;