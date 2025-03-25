'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import ArcadeCabinet with no SSR to avoid canvas-related errors
const ArcadeCabinet = dynamic(() => import('@/components/ArcadeCabinet'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-green-500 text-xl">Loading Arcade...</div>
    </div>
  ),
});

export default function Home() {
  return (
    <main>
      <Suspense fallback={
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
          <div className="text-green-500 text-xl">Loading Arcade...</div>
        </div>
      }>
        <ArcadeCabinet />
      </Suspense>
    </main>
  );
}
