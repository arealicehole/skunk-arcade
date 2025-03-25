'use client';

import { useEffect, useRef } from 'react';
import { SnakeGame } from '@/lib/SnakeGame';

export default function ArcadeCabinet() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<SnakeGame | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Set canvas size
    canvasRef.current.width = 600;
    canvasRef.current.height = 400;

    // Initialize game
    gameRef.current = new SnakeGame(canvasRef.current);
    gameRef.current.start();

    return () => {
      gameRef.current?.cleanup();
    };
  }, []);

  const handleRestart = () => {
    gameRef.current?.restart();
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="arcade-cabinet relative bg-gray-800 shadow-2xl">
        {/* Cabinet Top */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-[110%] h-12 bg-gray-800 rounded-t-3xl border-t-8 border-x-8 border-gray-700">
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-[80%] h-4 bg-gray-800 rounded-t-lg border-t-4 border-x-4 border-gray-700"></div>
        </div>
        
        {/* Main Cabinet Body */}
        <div className="relative border-8 border-gray-700 rounded-lg bg-gray-800 p-6">
          {/* Screen Bezel */}
          <div className="relative bg-black p-4 rounded-lg border-4 border-gray-700 shadow-inner mb-6">
            {/* CRT Screen Effect */}
            <div className="absolute inset-0 rounded-lg pointer-events-none bg-gradient-to-b from-transparent to-black opacity-20"></div>
            <div className="absolute inset-0 rounded-lg pointer-events-none bg-[radial-gradient(ellipse_at_center,_rgba(0,0,0,0)_0%,_rgba(0,0,0,0.3)_80%,_rgba(0,0,0,0.5)_100%)]"></div>
            
            {/* Game Canvas */}
            <canvas
              ref={canvasRef}
              className="rounded bg-black w-full"
              style={{
                imageRendering: 'pixelated',
              }}
            />
          </div>

          {/* Controls Section */}
          <div className="control-panel bg-gray-900 rounded-lg p-4 border-2 border-gray-700">
            <div className="flex justify-between items-center">
              <div className="text-gray-400 monospace text-xs space-y-2">
                <p>USE ARROW KEYS</p>
                <p>TO CONTROL</p>
                <button
                  onClick={handleRestart}
                  className="mt-2 px-3 py-1 bg-green-600 text-white text-xs monospace rounded hover:bg-green-700 transition-colors"
                >
                  RESTART GAME
                </button>
              </div>

              <div className="text-center">
                <h1 className="text-2xl monospace text-green-500 mb-1">SKUNK ARCADE</h1>
                <p className="text-gray-400 monospace text-[10px]">POWERED BY NEXT.JS</p>
              </div>

              <div className="bg-black p-3 rounded border border-gray-700">
                <div className="text-green-500 monospace text-xs">HIGH SCORE</div>
                <div className="text-green-500 monospace text-sm mt-1">00000</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
        
        .monospace {
          font-family: 'Press Start 2P', monospace;
        }
        
        .arcade-cabinet {
          box-shadow: 
            0 0 0 8px rgba(0, 0, 0, 0.2),
            0 20px 50px -12px rgba(0, 0, 0, 0.5);
          padding: 1rem;
          max-width: 800px;
          width: 100%;
        }

        canvas {
          aspect-ratio: 3/2;
          max-height: 500px;
        }
      `}</style>
    </div>
  );
} 