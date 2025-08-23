'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface ActivityEvent {
  id: number;
  timestamp: string;
  event_type: string;
  details: Record<string, any>;
  severity: 'INFO' | 'WARN' | 'ERROR';
}

export default function ActivityFeedPanel() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch initial events
    const fetchInitialEvents = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('activity_log')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(50);

        if (error) {
          throw new Error(error.message);
        }

        setEvents(data || []);
      } catch (err) {
        console.error('Error fetching activity events:', err);
      } finally {
        setLoading(false);
      }
    };

    // Subscribe to new events
    const subscription = supabase
      .channel('activity-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_log' },
        (payload) => {
          const newEvent = payload.new as ActivityEvent;
          setEvents(prevEvents => [newEvent, ...prevEvents].slice(0, 50)); // Keep only last 50 events
        }
      )
      .subscribe();

    fetchInitialEvents();

    // Cleanup subscription
    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const formatEventType = (eventType: string) => {
    return eventType
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'ERROR': return 'text-red-400';
      case 'WARN': return 'text-yellow-400';
      case 'INFO': return 'text-green-400';
      default: return 'text-gray-400';
    }
  };

  const formatDetails = (details: Record<string, any>) => {
    if (!details) return '';
    
    return Object.entries(details)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
  };

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <h3 className="text-lg font-semibold mb-3">Activity Feed</h3>
        <p className="text-gray-400">Loading activity feed...</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
      <h3 className="text-lg font-semibold mb-3">Activity Feed</h3>
      
      {events.length === 0 ? (
        <p className="text-gray-400 text-center py-4">No activity events yet.</p>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {events.map(event => (
            <div key={event.id} className="border-b border-gray-700 pb-3 last:border-0 last:pb-0">
              <div className="flex justify-between">
                <span className={`font-medium ${getSeverityColor(event.severity)}`}>
                  {formatEventType(event.event_type)}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
              </div>
              
              {event.details && (
                <p className="text-sm text-gray-300 mt-1">
                  {formatDetails(event.details)}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
