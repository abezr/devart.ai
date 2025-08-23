'use client';

import { useState } from 'react';

export default function AgentRegistrationPanel() {
  const [alias, setAlias] = useState('');
  const [capabilities, setCapabilities] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationResult, setRegistrationResult] = useState<{
    agent?: any;
    apiKey?: string;
    error?: string;
  } | null>(null);

  const handleRegisterAgent = async () => {
    if (!alias.trim()) {
      setRegistrationResult({ error: 'Agent alias is required' });
      return;
    }

    setIsRegistering(true);
    setRegistrationResult(null);

    try {
      const capabilityArray = capabilities
        .split(',')
        .map(c => c.trim())
        .filter(Boolean);
      
      const response = await fetch('/api/agents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alias, capabilities: capabilityArray }),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        setRegistrationResult(result);
        setAlias('');
        setCapabilities('');
      } else {
        setRegistrationResult({ error: result.error || 'Registration failed' });
      }
    } catch (error) {
      setRegistrationResult({ error: 'Network error during registration' });
    } finally {
      setIsRegistering(false);
    }
  };

  const handleCopyApiKey = () => {
    if (registrationResult?.apiKey) {
      navigator.clipboard.writeText(registrationResult.apiKey);
    }
  };

  return (
    <div className="bg-gray-800 p-6 rounded-lg">
      <h2 className="text-2xl font-semibold mb-4">Register New Agent</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Agent Alias
          </label>
          <input
            type="text"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            disabled={isRegistering}
            className="block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500"
            placeholder="e.g., python-refactor-agent-01"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Capabilities (comma-separated)
          </label>
          <input
            type="text"
            value={capabilities}
            onChange={(e) => setCapabilities(e.target.value)}
            disabled={isRegistering}
            className="block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500"
            placeholder="python, react, code-review"
          />
        </div>
        
        <button
          onClick={handleRegisterAgent}
          disabled={isRegistering || !alias.trim()}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded transition-colors"
        >
          {isRegistering ? 'Registering...' : 'Register Agent'}
        </button>
      </div>

      {/* Registration Result */}
      {registrationResult && (
        <div className="mt-6 p-4 rounded-md border">
          {registrationResult.error ? (
            <div className="border-red-500 bg-red-900/20 text-red-300">
              <h3 className="font-semibold text-red-200 mb-2">Registration Failed</h3>
              <p>{registrationResult.error}</p>
            </div>
          ) : (
            <div className="border-green-500 bg-green-900/20 text-green-300">
              <h3 className="font-semibold text-green-200 mb-2">Agent Registered Successfully!</h3>
              <div className="space-y-2">
                <p><strong>Agent ID:</strong> {registrationResult.agent?.id}</p>
                <p><strong>Alias:</strong> {registrationResult.agent?.alias}</p>
                
                {registrationResult.apiKey && (
                  <div className="mt-4 p-3 bg-yellow-900/30 border border-yellow-600 rounded">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-yellow-200">⚠️ API Key (ONE TIME ONLY)</h4>
                      <button
                        onClick={handleCopyApiKey}
                        className="bg-yellow-600 hover:bg-yellow-700 text-black font-bold py-1 px-3 rounded text-sm"
                      >
                        Copy
                      </button>
                    </div>
                    <code className="block p-2 bg-gray-900 text-yellow-300 rounded text-xs break-all">
                      {registrationResult.apiKey}
                    </code>
                    <p className="text-xs text-yellow-200 mt-2">
                      <strong>IMPORTANT:</strong> Save this API key immediately. It will not be shown again.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}