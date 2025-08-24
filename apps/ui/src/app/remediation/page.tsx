'use client';

import React from 'react';
import GenerativeRemediationDashboard from '@/components/GenerativeRemediationDashboard';
import { createClient } from '@/lib/supabase';

export default function GenerativeRemediationPage() {
  const supabase = createClient();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <GenerativeRemediationDashboard />
        </div>
      </div>
    </div>
  );
}