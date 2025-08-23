'use client';

import { useEffect, useState } from 'react';

interface SystemSetting {
  key: string;
  value: any;
  description: string;
  updated_at: string;
}

export default function SettingsPanel() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editedValues, setEditedValues] = useState<{ [key: string]: any }>({});

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
        // Initialize edited values with current values
        const initialValues: { [key: string]: any } = {};
        data.forEach((setting: SystemSetting) => {
          initialValues[setting.key] = setting.value;
        });
        setEditedValues(initialValues);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleValueChange = (key: string, value: any) => {
    setEditedValues(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = async (key: string) => {
    setSaving(key);
    try {
      const response = await fetch(`/api/settings/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: editedValues[key] }),
      });

      if (response.ok) {
        // Update the settings state with the new value
        setSettings(prev => prev.map(setting => 
          setting.key === key 
            ? { ...setting, value: editedValues[key], updated_at: new Date().toISOString() }
            : setting
        ));
      } else {
        console.error('Failed to save setting');
        // Reset to original value on error
        setEditedValues(prev => ({
          ...prev,
          [key]: settings.find(s => s.key === key)?.value
        }));
      }
    } catch (error) {
      console.error('Error saving setting:', error);
    } finally {
      setSaving(null);
    }
  };

  const hasChanges = (key: string) => {
    const original = settings.find(s => s.key === key)?.value;
    const edited = editedValues[key];
    return original !== edited;
  };

  const renderValueInput = (setting: SystemSetting) => {
    const { key, value } = setting;
    const editedValue = editedValues[key];

    // For numeric values
    if (typeof value === 'number' || !isNaN(Number(value))) {
      return (
        <input
          type="number"
          step="0.1"
          value={editedValue || ''}
          onChange={(e) => handleValueChange(key, parseFloat(e.target.value) || 0)}
          className="block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500"
        />
      );
    }

    // For string values
    if (typeof value === 'string') {
      return (
        <input
          type="text"
          value={editedValue || ''}
          onChange={(e) => handleValueChange(key, e.target.value)}
          className="block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500"
        />
      );
    }

    // For boolean values
    if (typeof value === 'boolean') {
      return (
        <label className="inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={editedValue || false}
            onChange={(e) => handleValueChange(key, e.target.checked)}
            className="sr-only peer"
          />
          <div className="relative w-11 h-6 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      );
    }

    // Fallback for complex objects
    return (
      <textarea
        value={JSON.stringify(editedValue, null, 2)}
        onChange={(e) => {
          try {
            const parsed = JSON.parse(e.target.value);
            handleValueChange(key, parsed);
          } catch {
            // Invalid JSON, keep as string for now
            handleValueChange(key, e.target.value);
          }
        }}
        rows={3}
        className="block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500 font-mono text-sm"
      />
    );
  };

  if (loading) {
    return (
      <div className="bg-gray-800 p-6 rounded-lg">
        <h2 className="text-2xl font-semibold mb-4">System Settings</h2>
        <div className="flex items-center justify-center py-8">
          <div className="text-gray-400">Loading settings...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 p-6 rounded-lg">
      <h2 className="text-2xl font-semibold mb-4">System Settings</h2>
      
      {settings.length === 0 ? (
        <p className="text-gray-400 text-center py-4">No settings available</p>
      ) : (
        <div className="space-y-6">
          {settings.map((setting) => (
            <div key={setting.key} className="bg-gray-700 p-4 rounded-md">
              <div className="mb-2">
                <h3 className="text-lg font-medium text-white capitalize">
                  {setting.key.replace(/_/g, ' ')}
                </h3>
                {setting.description && (
                  <p className="text-sm text-gray-400 mt-1">{setting.description}</p>
                )}
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="flex-1">
                  {renderValueInput(setting)}
                </div>
                <button
                  onClick={() => handleSave(setting.key)}
                  disabled={!hasChanges(setting.key) || saving === setting.key}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded transition-colors min-w-[80px]"
                >
                  {saving === setting.key ? 'Saving...' : 'Save'}
                </button>
              </div>
              
              {setting.updated_at && (
                <p className="text-xs text-gray-500 mt-2">
                  Last updated: {new Date(setting.updated_at).toLocaleString()}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}