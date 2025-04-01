'use client';

import { useEffect, useRef, useState } from 'react';
import { StankGame } from '@/lib/StankGame';
import { BongGame } from '@/lib/BongGame';
import { GameEngine } from '@/lib/GameEngine';

type GameType = 'stank' | 'bong';

export default function ArcadeCabinet() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameEngine | null>(null);
  const [currentGame, setCurrentGame] = useState<GameType>('stank');
  const [isPlaying, setIsPlaying] = useState(false);

  // Initialize the selected game
  useEffect(() => {
    if (!canvasRef.current) return;

    // Clean up previous game if exists
    if (gameRef.current) {
      gameRef.current.cleanup();
      gameRef.current = null;
    }

    // Set canvas size
    canvasRef.current.width = 600;
    canvasRef.current.height = 400;

    // Initialize game based on selection
    if (currentGame === 'stank') {
      gameRef.current = new StankGame(canvasRef.current);
    } else if (currentGame === 'bong') {
      gameRef.current = new BongGame(canvasRef.current);
    }

    // Start game if we were playing
    if (isPlaying) {
      gameRef.current?.start();
    }

    return () => {
      gameRef.current?.cleanup();
    };
  }, [currentGame, isPlaying]);

  const handleStartGame = () => {
    if (!isPlaying) {
      setIsPlaying(true);
      gameRef.current?.start();
    }
  };

  const handleSelectGame = (game: GameType) => {
    setIsPlaying(false);
    setCurrentGame(game);
  };

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
          {/* Game Selection When Not Playing */}
          {!isPlaying && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black bg-opacity-80 p-8 rounded-lg">
              <h2 className="text-green-500 monospace text-2xl mb-8">SELECT GAME</h2>
              
              <div className="grid grid-cols-2 gap-6 w-full max-w-xl">
                <button 
                  onClick={() => handleSelectGame('stank')}
                  className={`p-4 rounded-lg border-2 flex flex-col items-center justify-center ${
                    currentGame === 'stank' ? 'border-green-500 bg-green-900 bg-opacity-50' : 'border-gray-700 hover:border-green-700'
                  }`}
                >
                  <div className="h-32 flex items-center justify-center mb-2">
                    <img src="/images/game-covers/STANK.png" alt="Stank Game" className="h-32 w-32 object-contain" />
                  </div>
                  <span className="monospace text-green-500 text-center">STANK</span>
                </button>
                
                <button
                  onClick={() => handleSelectGame('bong')}
                  className={`p-4 rounded-lg border-2 flex flex-col items-center justify-center ${
                    currentGame === 'bong' ? 'border-green-500 bg-green-900 bg-opacity-50' : 'border-gray-700 hover:border-green-700'
                  }`}
                >
                  <div className="h-32 flex items-center justify-center mb-2">
                    <img src="/images/game-covers/BONG.png" alt="Bong Game" className="h-32 w-32 object-contain" />
                  </div>
                  <span className="monospace text-green-500 text-center">BONG</span>
                </button>
              </div>
              
              <button
                onClick={handleStartGame}
                className="mt-8 px-6 py-3 bg-green-600 text-white monospace rounded-lg hover:bg-green-700 transition-colors"
              >
                START GAME
              </button>
            </div>
          )}
          
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
                {currentGame === 'stank' ? (
                  <>
                    <p>USE ARROW KEYS</p>
                    <p>TO CONTROL</p>
                  </>
                ) : (
                  <>
                    <p>P1: W/S KEYS</p>
                    <p>P2: ARROW KEYS</p>
                  </>
                )}
                <div className="flex space-x-2">
                  <button
                    onClick={handleRestart}
                    className="mt-2 px-3 py-1 bg-green-600 text-white text-xs monospace rounded hover:bg-green-700 transition-colors"
                  >
                    RESTART
                  </button>
                  
                  {isPlaying && (
                    <button
                      onClick={() => setIsPlaying(false)}
                      className="mt-2 px-3 py-1 bg-red-600 text-white text-xs monospace rounded hover:bg-red-700 transition-colors"
                    >
                      MENU
                    </button>
                  )}
                </div>
              </div>

              <div className="text-center">
                <h1 className="text-2xl monospace text-green-500 mb-1">SKUNK ARCADE</h1>
                <p className="text-gray-400 monospace text-[10px]">POWERED BY NEXT.JS</p>
              </div>

              <div className="bg-black p-3 rounded border border-gray-700">
                <div className="text-green-500 monospace text-xs">GAME</div>
                <div className="text-green-500 monospace text-sm mt-1">
                  {currentGame === 'stank' ? 'STANK' : 'BONG'}
                </div>
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