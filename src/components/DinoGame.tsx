import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Heart, RotateCcw, Play, Trophy, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 200;
const GROUND_Y = 160;
const DINO_WIDTH = 44;
const DINO_HEIGHT = 47;
const GRAVITY = 0.6;
const JUMP_FORCE = -12;
const INITIAL_SPEED = 4.5;
const SPEED_INCREMENT = 0.0005;
const INVINCIBLE_DURATION = 2000; // 2 seconds of invincibility after hit

const DINO_X_POSITION = 150; // Moved from 50 to 150

// Sound Manager using Web Audio API
let audioCtx: AudioContext | null = null;
let isSoundEnabledGlobal = true;

const getAudioContext = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
};

const playSound = (type: 'jump' | 'hit' | 'score') => {
  if (!isSoundEnabledGlobal) return;
  
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  const now = ctx.currentTime;

  if (type === 'jump') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc.start(now);
    osc.stop(now + 0.1);
  } else if (type === 'hit') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.linearRampToValueAtTime(40, now + 0.2);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.2);
  } else if (type === 'score') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(1100, now + 0.1);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.2);
  }
};

type GameState = 'START' | 'PLAYING' | 'GAME_OVER';

interface Obstacle {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'cactus' | 'bird';
  passed: boolean;
}

export const DinoGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>('START');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [isInvincible, setIsInvincible] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Sync global sound state
  useEffect(() => {
    isSoundEnabledGlobal = soundEnabled;
  }, [soundEnabled]);

  // Game variables (refs to avoid re-renders during loop)
  const dinoY = useRef(GROUND_Y - DINO_HEIGHT);
  const dinoVelocityY = useRef(0);
  const isJumping = useRef(false);
  const isDucking = useRef(false);
  const obstacles = useRef<Obstacle[]>([]);
  const gameSpeed = useRef(INITIAL_SPEED);
  const frameCount = useRef(0);
  const lastObstacleTime = useRef(0);
  const requestRef = useRef<number>(null);
  const invincibilityTimer = useRef<number | null>(null);

  const resetGame = useCallback(() => {
    setGameState('PLAYING');
    setScore(0);
    setLives(3);
    setIsInvincible(false);
    dinoY.current = GROUND_Y - DINO_HEIGHT;
    dinoVelocityY.current = 0;
    isJumping.current = false;
    isDucking.current = false;
    obstacles.current = [];
    gameSpeed.current = INITIAL_SPEED;
    frameCount.current = 0;
    lastObstacleTime.current = 0;
    if (invincibilityTimer.current) clearTimeout(invincibilityTimer.current);
  }, []);

  const handleHit = useCallback(() => {
    if (isInvincible) return;
    
    playSound('hit');

    setLives(prev => {
      const newLives = prev - 1;
      if (newLives <= 0) {
        setGameState('GAME_OVER');
        return 0;
      }
      
      // Grant temporary invincibility
      setIsInvincible(true);
      invincibilityTimer.current = window.setTimeout(() => {
        setIsInvincible(false);
      }, INVINCIBLE_DURATION);
      
      return newLives;
    });
  }, [isInvincible]);

  const spawnObstacle = () => {
    const type = Math.random() > 0.7 ? 'bird' : 'cactus';
    const height = type === 'cactus' ? 35 + Math.random() * 20 : 30;
    const width = type === 'cactus' ? 20 + Math.random() * 10 : 40;
    const y = type === 'cactus' ? GROUND_Y - height : GROUND_Y - height - 30 - Math.random() * 30;

    obstacles.current.push({
      x: CANVAS_WIDTH,
      y,
      width,
      height,
      type,
      passed: false
    });
  };

  const update = () => {
    if (gameState !== 'PLAYING') return;

    frameCount.current++;
    gameSpeed.current += SPEED_INCREMENT;

    // Dino Physics
    if (isJumping.current) {
      dinoVelocityY.current += GRAVITY;
      dinoY.current += dinoVelocityY.current;

      if (dinoY.current >= GROUND_Y - DINO_HEIGHT) {
        dinoY.current = GROUND_Y - DINO_HEIGHT;
        dinoVelocityY.current = 0;
        isJumping.current = false;
      }
    }

    // Spawn obstacles
    if (frameCount.current - lastObstacleTime.current > 100 / (gameSpeed.current / 6)) {
      if (Math.random() > 0.98) {
        spawnObstacle();
        lastObstacleTime.current = frameCount.current;
      }
    }

    // Update obstacles
    obstacles.current.forEach((obs, index) => {
      obs.x -= gameSpeed.current;

      // Collision detection
      const dinoHitbox = {
        x: DINO_X_POSITION,
        y: isDucking.current ? dinoY.current + 20 : dinoY.current,
        width: DINO_WIDTH - 10,
        height: isDucking.current ? DINO_HEIGHT - 20 : DINO_HEIGHT - 5
      };

      if (
        dinoHitbox.x < obs.x + obs.width &&
        dinoHitbox.x + dinoHitbox.width > obs.x &&
        dinoHitbox.y < obs.y + obs.height &&
        dinoHitbox.y + dinoHitbox.height > obs.y
      ) {
        handleHit();
      }

      // Score tracking
      if (!obs.passed && obs.x + obs.width < DINO_X_POSITION) {
        obs.passed = true;
        setScore(s => {
          const newScore = s + 10;
          if (newScore % 100 === 0) playSound('score');
          return newScore;
        });
      }
    });

    // Remove off-screen obstacles
    obstacles.current = obstacles.current.filter(obs => obs.x + obs.width > 0);
  };

  const draw = (ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw Ground
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(CANVAS_WIDTH, GROUND_Y);
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw Dino
    ctx.fillStyle = isInvincible ? `rgba(85, 85, 85, ${0.5 + Math.sin(Date.now() / 100) * 0.3})` : '#555';
    const currentDinoHeight = isDucking.current ? DINO_HEIGHT / 2 : DINO_HEIGHT;
    const currentDinoY = isDucking.current ? dinoY.current + DINO_HEIGHT / 2 : dinoY.current;
    
    // Pixel Dino
    const x = DINO_X_POSITION;
    const y = currentDinoY;
    
    ctx.save();
    if (isInvincible) {
      ctx.globalAlpha = 0.5 + Math.sin(Date.now() / 100) * 0.3;
    }

    if (isDucking.current) {
      // Ducking Dino
      ctx.fillStyle = '#555';
      ctx.fillRect(x, y + 20, 40, 16); // Body
      ctx.fillRect(x + 35, y + 20, 15, 12); // Head
      ctx.fillStyle = 'white';
      ctx.fillRect(x + 42, y + 22, 3, 3); // Eye
    } else {
      // Detailed Standing Dino
      ctx.fillStyle = '#555';
      // Body
      ctx.fillRect(x, y + 16, 26, 20);
      // Neck
      ctx.fillRect(x + 18, y + 8, 10, 10);
      // Head
      ctx.fillRect(x + 20, y, 24, 16);
      // Snout
      ctx.fillRect(x + 38, y + 4, 8, 8);
      // Tail
      ctx.beginPath();
      ctx.moveTo(x, y + 20);
      ctx.lineTo(x - 8, y + 28);
      ctx.lineTo(x, y + 32);
      ctx.fill();
      
      // Arms
      ctx.fillRect(x + 22, y + 22, 6, 4);

      // Legs
      const step = Math.floor(frameCount.current / 8) % 2;
      if (gameState === 'PLAYING' && !isJumping.current) {
        if (step === 0) {
          ctx.fillRect(x + 6, y + 36, 8, 11); // Left leg
          ctx.fillRect(x + 18, y + 36, 8, 6);  // Right leg
        } else {
          ctx.fillRect(x + 6, y + 36, 8, 6);   // Left leg
          ctx.fillRect(x + 18, y + 36, 8, 11); // Right leg
        }
      } else {
        ctx.fillRect(x + 6, y + 36, 8, 11);
        ctx.fillRect(x + 18, y + 36, 8, 11);
      }
      
      // Eye
      ctx.fillStyle = 'white';
      ctx.fillRect(x + 26, y + 4, 4, 4);
    }
    ctx.restore();

    // Draw Obstacles
    obstacles.current.forEach(obs => {
      if (obs.type === 'cactus') {
        ctx.fillStyle = '#2d5a27'; // Green cactus
        // Main stem
        ctx.fillRect(obs.x + obs.width / 3, obs.y, obs.width / 3, obs.height);
        // Left arm
        ctx.fillRect(obs.x, obs.y + obs.height / 3, obs.width / 3, 5);
        ctx.fillRect(obs.x, obs.y + obs.height / 3 - 10, 5, 10);
        // Right arm
        ctx.fillRect(obs.x + (obs.width / 3) * 2, obs.y + obs.height / 2, obs.width / 3, 5);
        ctx.fillRect(obs.x + obs.width - 5, obs.y + obs.height / 2 - 10, 5, 10);
      } else {
        // Bird - Yellow and Blue
        const wingPos = Math.sin(frameCount.current * 0.2) > 0 ? 0 : 1;
        
        // Body (Yellow)
        ctx.fillStyle = '#f1c40f';
        ctx.fillRect(obs.x + 10, obs.y + 10, 20, 10);
        // Head
        ctx.fillRect(obs.x, obs.y + 5, 12, 10);
        // Beak
        ctx.fillStyle = '#e67e22';
        ctx.fillRect(obs.x - 4, obs.y + 8, 6, 4);
        
        // Wings (Blue)
        ctx.fillStyle = '#3498db';
        if (wingPos === 0) {
          ctx.fillRect(obs.x + 15, obs.y, 10, 10); // Wing up
        } else {
          ctx.fillRect(obs.x + 15, obs.y + 15, 10, 10); // Wing down
        }
      }
    });
  };

  const loop = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx) {
      update();
      draw(ctx);
    }
    requestRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(loop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gameState, isInvincible, handleHit]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== 'PLAYING') {
        if (e.code === 'Space' || e.code === 'ArrowUp') {
          if (gameState === 'START' || gameState === 'GAME_OVER') {
            resetGame();
          }
        }
        return;
      }

      if ((e.code === 'Space' || e.code === 'ArrowUp') && !isJumping.current) {
        isJumping.current = true;
        dinoVelocityY.current = JUMP_FORCE;
        playSound('jump');
      }
      if (e.code === 'ArrowDown') {
        isDucking.current = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowDown') {
        isDucking.current = false;
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      // Resume audio context on first interaction
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      // Prevent scrolling when touching the game area
      if (e.target instanceof HTMLCanvasElement) {
        e.preventDefault();
      }

      if (gameState !== 'PLAYING') {
        if (gameState === 'START' || gameState === 'GAME_OVER') {
          resetGame();
        }
        return;
      }

      // Mobile controls:
      // 1. If touching the bottom half of the screen -> Duck
      // 2. If touching the top half of the screen -> Jump
      const touchY = e.touches[0].clientY;
      const screenHeight = window.innerHeight;

      if (touchY > screenHeight / 2) {
        isDucking.current = true;
      } else {
        if (!isJumping.current) {
          isJumping.current = true;
          dinoVelocityY.current = JUMP_FORCE;
          playSound('jump');
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      isDucking.current = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [gameState, resetGame]);

  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
    }
  }, [score, highScore]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-stone-50 p-4 font-sans">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-xl overflow-hidden border border-stone-200">
        
        {/* HUD */}
        <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-10 pointer-events-none">
          <div className="flex flex-col gap-1">
            <div className="flex gap-2">
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={false}
                  animate={{
                    scale: i < lives ? 1 : 0.8,
                    opacity: i < lives ? 1 : 0.3,
                  }}
                >
                  <Heart 
                    className={`w-6 h-6 ${i < lives ? 'fill-red-500 text-red-500' : 'text-stone-300'}`} 
                  />
                </motion.div>
              ))}
            </div>
            <div className="text-stone-400 text-xs font-mono mt-2">
              LIVES: {lives}/3
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-4 mb-1 pointer-events-auto">
              <button 
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="p-2 bg-stone-100 hover:bg-stone-200 rounded-full transition-colors text-stone-600"
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
              <div className="text-3xl font-black text-stone-800 tracking-tighter">
                {score.toString().padStart(5, '0')}
              </div>
            </div>
            <div className="flex items-center gap-1 text-stone-400 text-xs font-mono">
              <Trophy className="w-3 h-3" />
              HI {highScore.toString().padStart(5, '0')}
            </div>
          </div>
        </div>

        {/* Game Canvas */}
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="w-full h-auto block bg-stone-50/50"
        />

        {/* Overlays */}
        <AnimatePresence>
          {gameState === 'START' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-20 p-4"
            >
              <h1 className="text-4xl sm:text-5xl font-black text-stone-900 mb-1 tracking-tighter">DINO RUNNER</h1>
              <p className="text-stone-500 mb-4 sm:mb-8 font-medium text-sm sm:text-base text-center">Press SPACE, UP or TAP to start</p>
              <button 
                onClick={resetGame}
                className="group relative px-6 py-3 sm:px-8 sm:py-4 bg-stone-900 text-white rounded-full font-bold overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-lg"
              >
                <span className="relative z-10 flex items-center gap-2 text-sm sm:text-base">
                  <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                  START GAME
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-stone-800 to-stone-900 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </motion.div>
          )}

          {gameState === 'GAME_OVER' && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute inset-0 bg-stone-900/95 backdrop-blur-sm flex flex-col items-center justify-center z-20 text-white p-4"
            >
              <h2 className="text-5xl font-black mb-6 tracking-tighter">GAME OVER</h2>
              <div className="flex gap-8 mb-8">
                <div className="text-center">
                  <div className="text-stone-400 text-[10px] uppercase tracking-widest mb-1 font-medium">Final Score</div>
                  <div className="text-3xl font-bold">{score}</div>
                </div>
                <div className="w-px h-10 bg-stone-700 self-center" />
                <div className="text-center">
                  <div className="text-stone-400 text-[10px] uppercase tracking-widest mb-1 font-medium">Best Run</div>
                  <div className="text-3xl font-bold">{highScore}</div>
                </div>
              </div>
              <button 
                onClick={resetGame}
                className="flex items-center gap-2 px-8 py-3 bg-white text-stone-900 rounded-full font-bold shadow-xl transition-all hover:bg-stone-100 hover:scale-105 active:scale-95"
              >
                <RotateCcw className="w-5 h-5" />
                <span className="text-lg">TRY AGAIN</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Controls Help */}
        <div className="p-4 bg-stone-100 border-t border-stone-200 flex justify-center gap-8 text-stone-500 text-sm font-medium">
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-1 bg-white border border-stone-300 rounded shadow-sm text-xs">SPACE</kbd>
            <span>Jump</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-1 bg-white border border-stone-300 rounded shadow-sm text-xs">↓</kbd>
            <span>Duck</span>
          </div>
        </div>
      </div>

      <div className="mt-8 text-stone-400 text-sm max-w-md text-center">
        Classic endless runner with a twist. You have 3 lives. 
        Getting hit grants temporary invincibility. How far can you go?
      </div>
    </div>
  );
};
