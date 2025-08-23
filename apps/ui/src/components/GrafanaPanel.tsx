'use client';

import { useEffect, useState } from 'react';

interface GrafanaPanelProps {
  dashboardId: string;
  panelId: string;
  title: string;
}

export default function GrafanaPanel({ dashboardId, panelId, title }: GrafanaPanelProps) {
  const [grafanaUrl, setGrafanaUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // In a real implementation, you would get this from environment variables or configuration
    const baseUrl = process.env.NEXT_PUBLIC_GRAFANA_URL || 'http://localhost:3001';
    
    // Construct the iframe URL for the Grafana panel
    const panelUrl = `${baseUrl}/d-solo/${dashboardId}/${title}?orgId=1&panelId=${panelId}`;
    setGrafanaUrl(panelUrl);
    setLoading(false);
  }, [dashboardId, panelId, title]);

  if (loading) {
    return (
      <div className="bg-gray-800 p-6 rounded-lg">
        <h2 className="text-2xl font-semibold text-white mb-4">{title}</h2>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
          <span className="ml-2 text-gray-400">Loading Grafana panel...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800 p-6 rounded-lg">
        <h2 className="text-2xl font-semibold text-white mb-4">{title}</h2>
        <div className="text-center py-8">
          <p className="text-red-400 mb-2">Error loading Grafana panel: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 p-6 rounded-lg">
      <h2 className="text-2xl font-semibold text-white mb-4">{title}</h2>
      <div className="w-full h-80">
        <iframe
          src={grafanaUrl}
          width="100%"
          height="100%"
          frameBorder="0"
          className="rounded-md"
        ></iframe>
      </div>
    </div>
  );
}