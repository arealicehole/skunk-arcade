import { GameEngine } from './GameEngine';

type PieceType = 'bong' | 'blunt' | 'doobie' | 'preach' | 'weed';

interface StackCell {
  x: number | undefined;
  y: number | undefined;
  type: PieceType | undefined;
  color: string | undefined;
  placedAt: number | undefined;
}

interface FallingPiece {
  x: number;
  y: number;
  shape: number[][];
  color: string;
  glowColor: string;
}

export class StankStackGame extends GameEngine {
  private cols = 10;
  private rows = 18;
  private blockSize = 24;
  private stackOffsetTop = 40;
  private stackOffsetLeft = 50;
  
  private fallingPiece: FallingPiece | null = null;
  private pieceTimer = 0;
  private nextDropTime = 0;
  private dropInterval = 1000;
  
  private stack: (StackCell | undefined)[][] = [];
  
  private score = 0;
  private level = 1;
  private linesCleared = 0;
  private combo = 0;
  private comboTimer = 0;
  
  private particles: { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number; isSmoke: boolean }[] = [];
  private smokeWisps: { x: number; y: number; size: number; alpha: number; drift: number; phase: number }[] = [];
  private time = 0;
  private shake = 0;
  
  constructor(canvas: HTMLCanvasElement) {
    super(canvas);
    this.initSmoke();
    this.reset();
  }
  
  private initSmoke() {
    for (let i = 0; i < 12; i++) {
      this.smokeWisps.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        size: Math.random() * 50 + 25,
        alpha: Math.random() * 0.05 + 0.02,
        drift: (Math.random() - 0.5) * 0.3,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }
  
  private reset() {
    this.stack = [];
    for (let y = 0; y < this.rows; y++) {
      (this.stack[y] as StackCell[]) = [];
      for (let x = 0; x < this.cols; x++) {
        this.stack[y][x] = undefined;
      }
    }
    
    this.spawnPiece();
    this.score = 0;
    this.level = 1;
    this.linesCleared = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.particles = [];
    this.time = 0;
    this.shake = 0;
    
    this.gameState = 'running';
  }
  
  private spawnPiece() {
    const pieceTypes: PieceType[] = ['bong', 'blunt', 'doobie', 'preach', 'weed'];
    const shapes: Record<PieceType, number[][]> = {
      bong: [[1, 1, 1], [1, 1, 1]],
      blunt: [[1, 1, 1], [0, 1, 0], [0, 1, 0]],
      doobie: [[1, 0], [1, 0], [1, 0], [1, 0]],
      preach: [[0, 1, 0], [1, 1, 1], [0, 1, 0]],
      weed: [[1, 1], [1, 1]],
    };
    
    const colors: Record<PieceType, string> = {
      bong: '#8B0000',
      blunt: '#1B5E20',
      doobie: '#B8860B',
      preach: '#00FF88',
      weed: '#4CAF50',
    };
    
    const glowColors: Record<PieceType, string> = {
      bong: '#FF4444',
      blunt: '#4CAF50',
      doobie: '#FFD700',
      preach: '#00FF88',
      weed: '#2E7D32',
    };
    
    const type = pieceTypes[Math.floor(Math.random() * pieceTypes.length)];
    this.fallingPiece = {
      x: Math.floor(this.cols / 2) - Math.floor(shapes[type][0].length / 2),
      y: 0,
      shape: shapes[type],
      color: colors[type],
      glowColor: glowColors[type],
    };
    
    this.pieceTimer = 0;
    this.nextDropTime = performance.now() + this.dropInterval;
  }
  
  protected setupEventListeners() {
    super.setupEventListeners();
    window.addEventListener('keyup', this.handleKeyUp.bind(this));
  }
  
  public cleanup() {
    super.cleanup();
    window.removeEventListener('keyup', this.handleKeyUp.bind(this));
  }
  
  private handleKeyUp(event: KeyboardEvent) {
    if (this.gameState === 'gameover' || this.gameState === 'paused') {
      if (event.key === 'Enter') this.restart();
      return;
    }
    
    if (event.key === 'p' || event.key === 'P') {
      if (this.gameState === 'running') this.pause();
      else if (this.gameState === 'paused') this.resume();
    }
  }
  
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected handleKeyDown(_event: KeyboardEvent) {
    // Movement happens on keyup for smoother control
  }
  
  protected update(deltaTime: number) {
    if (this.gameState !== 'running') return;
    
    this.time += deltaTime;
    this.shake *= 0.9;
    if (this.shake < 0.5) this.shake = 0;
    
    this.comboTimer -= deltaTime;
    if (this.comboTimer <= 0) this.combo = 0;
    
    this.pieceTimer += deltaTime;
    if (this.pieceTimer >= this.dropInterval) {
      this.dropPiece();
    }
    
    this.updateSmoke();
    
    if (this.fallingPiece && this.fallingPiece.y + 1 < 0) {
      this.gameState = 'gameover';
      this.shake = 10;
    }
    
    this.updateParticles();
  }
  
  private updateSmoke() {
    for (const s of this.smokeWisps) {
      s.y -= s.alpha * 0.5;
      s.x += Math.sin(this.time * 0.001 + s.phase) * s.drift;
      if (s.y + s.size < 0) {
        s.y = this.canvas.height + s.size;
        s.x = Math.random() * this.canvas.width;
      }
    }
  }
  
  private dropPiece() {
    if (!this.fallingPiece) return;
    
    const { x, y, shape } = this.fallingPiece;
    
    if (this.canPlace(x, y + 1, shape)) {
      this.fallingPiece.y += 1;
    } else {
      this.lockPiece();
      this.spawnPiece();
    }
  }
  
  private canPlace(px: number, py: number, shape: number[][]): boolean {
    for (let sy = 0; sy < shape.length; sy++) {
      for (let sx = 0; sx < shape[sy].length; sx++) {
        if (shape[sy][sx] === 1) {
          const nx = px + sx;
          const ny = py + sy;
          
          if (nx < 0 || nx >= this.cols || ny >= this.rows) {
            return false;
          }
          
          if (ny >= 0 && this.stack[ny][nx] !== null) {
            return false;
          }
        }
      }
    }
    return true;
  }
  
  private lockPiece() {
    if (!this.fallingPiece) return;
    
    const { x, y, shape, color } = this.fallingPiece;
    
    for (let sy = 0; sy < shape.length; sy++) {
      for (let sx = 0; sx < shape[sy].length; sx++) {
        if (shape[sy][sx] === 1) {
          const nx = x + sx;
          const ny = y + sy;
          if (ny >= 0 && ny < this.rows && nx >= 0 && nx < this.cols) {
            this.stack[ny][nx] = {
              x: nx,
              y: ny,
              type: 'bong',
              color: color,
              placedAt: this.time,
            };
          }
        }
      }
    }
    
    this.checkLines();
    
    const centerX = x + Math.floor(shape[0].length / 2) * this.blockSize;
    const centerY = y * this.blockSize + this.stackOffsetTop;
    for (let i = 0; i < 8; i++) {
      this.particles.push({
        x: centerX + (Math.random() - 0.5) * 20,
        y: centerY + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 4,
        vy: -Math.random() * 3 - 1,
        life: 1,
        color: '200,200,200',
        size: Math.random() * 6 + 3,
        isSmoke: Math.random() < 0.4,
      });
    }
  }
  
 private checkLines() {
    const linesToClear: number[] = [];
    
    for (let y = 0; y < this.rows; y++) {
      let full = true;
      for (let x = 0; x < this.cols; x++) {
        if (this.stack[y][x] === undefined) {
          full = false;
          break;
        }
      }
      if (full) linesToClear.push(y);
    }
    
    if (linesToClear.length > 0) {
      linesToClear.sort((a, b) => b - a);
      
      let totalLines = 0;
      for (const y of linesToClear) {
        this.stack.splice(y, 1);
        const newLine = new Array(this.cols).fill(undefined);
        this.stack.unshift(newLine);
        totalLines++;
      }
      
      const baseScore = [0, 100, 300, 500, 800][totalLines];
      const comboMultiplier = 1 + this.combo * 0.2;
      this.score += Math.round(baseScore * comboMultiplier);
      this.linesCleared += totalLines;
      this.combo++;
      this.comboTimer = 5000;
      
      const newLevel = Math.floor(this.linesCleared / 10) + 1;
      if (newLevel > this.level) {
        this.level = newLevel;
        this.dropInterval = Math.max(200, 1000 - (this.level - 1) * 100);
      }
      
      this.shake = 5;
    }
  }

  private updateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1;
      p.life -= 0.02;
      
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      
      const alpha = Math.max(0, parseFloat(p.color));
      if (p.isSmoke) {
        const g = this.ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * alpha);
        g.addColorStop(0, `rgba(200, 200, 200, ${alpha * 0.4})`);
        g.addColorStop(1, 'rgba(200, 200, 200, 0)');
        this.ctx.fillStyle = g;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
  }

  protected render() {
    const shakeX = (Math.random() - 0.5) * this.shake;
    const shakeY = (Math.random() - 0.5) * this.shake;
    
    this.ctx.save();
    this.ctx.translate(shakeX, shakeY);
    
    this.renderBackground();
    this.renderStack();
    this.renderFallingPiece();
    this.renderParticles();
    this.renderHUD();
    this.renderSmokeWisps();
    
    if (this.gameState === 'paused') this.renderOverlay('PAUSED', 'PRESS P TO RESUME');
    if (this.gameState === 'gameover') this.renderGameOver();
    
    this.ctx.restore();
  }
  
  private renderBackground() {
    const grad = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    grad.addColorStop(0, '#0a0612');
    grad.addColorStop(0.5, '#0d1117');
    grad.addColorStop(1, '#0a1a0a');
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.ctx.strokeStyle = 'rgba(0, 255, 100, 0.02)';
    this.ctx.lineWidth = 1;
    for (let y = 0; y < this.canvas.height; y += 4) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
      this.ctx.stroke();
    }
  }
  
  private renderSmokeWisps() {
    for (const s of this.smokeWisps) {
      const grad = this.ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.size);
      grad.addColorStop(0, `rgba(140, 200, 140, ${s.alpha})`);
      grad.addColorStop(1, 'rgba(80, 120, 80, 0)');
      this.ctx.fillStyle = grad;
      this.ctx.beginPath();
      this.ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }
  
  private renderStack() {
    const stackY = this.stackOffsetTop;
    
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const cell = this.stack[y][x];
        if (cell && cell.color) {
          const screenX = this.stackOffsetLeft + x * this.blockSize;
          const screenY = stackY + y * this.blockSize;
          this.renderStackedPiece(screenX, screenY, cell.color);
        }
      }
    }
  }
  
  private renderStackedPiece(x: number, y: number, color: string) {
    this.ctx.fillStyle = '#1a1a1a';
    this.ctx.fillRect(x, y, this.blockSize, this.blockSize);
    
    this.ctx.fillStyle = color;
    this.ctx.globalAlpha = 0.7;
    this.ctx.fillRect(x + 2, y + 2, this.blockSize - 4, this.blockSize - 4);
    this.ctx.globalAlpha = 1;
    
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x + 3, y + 3, this.blockSize - 6, this.blockSize - 6);
  }
  
  private renderFallingPiece() {
    if (!this.fallingPiece) return;
    
    const { x, y, shape, color } = this.fallingPiece;
    
    for (let sy = 0; sy < shape.length; sy++) {
      for (let sx = 0; sx < shape[sy].length; sx++) {
        if (shape[sy][sx] === 1) {
          const screenX = this.stackOffsetLeft + (x + sx) * this.blockSize;
          const screenY = this.stackOffsetTop + (y + sy) * this.blockSize;
          
          const g = this.ctx.createRadialGradient(screenX + this.blockSize / 2, screenY + this.blockSize / 2, 2, screenX + this.blockSize / 2, screenY + this.blockSize / 2, this.blockSize * 0.8);
          g.addColorStop(0, `rgba(${this.getRGB(color)[0]}, ${this.getRGB(color)[1]}, ${this.getRGB(color)[2]}, 0.3)`);
          g.addColorStop(1, 'rgba(0, 0, 0, 0)');
          this.ctx.fillStyle = g;
          this.ctx.fillRect(screenX - 2, screenY - 2, this.blockSize + 4, this.blockSize + 4);
          
          this.ctx.fillStyle = color;
          this.ctx.fillRect(screenX + 2, screenY + 2, this.blockSize - 4, this.blockSize - 4);
          
          this.ctx.strokeStyle = '#FFFFFF';
          this.ctx.lineWidth = 2;
          this.ctx.strokeRect(screenX + 3, screenY + 3, this.blockSize - 6, this.blockSize - 6);
        }
      }
    }
  }
  
  private getRGB(color: string): [number, number, number] {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return [r, g, b];
  }
  
  private renderParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1;
      p.life -= 0.02;
      
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      
      const alpha = Math.max(0, parseFloat(p.color));
      if (p.isSmoke) {
        const g = this.ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * alpha);
        g.addColorStop(0, `rgba(200, 200, 200, ${alpha * 0.4})`);
        g.addColorStop(1, 'rgba(200, 200, 200, 0)');
        this.ctx.fillStyle = g;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        this.ctx.fill();
      } else {
        this.ctx.fillStyle = `rgba(200, 200, 200, ${alpha})`;
        this.ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }
  }
  
  private renderHUD() {
    this.ctx.shadowColor = '#00FF66';
    this.ctx.shadowBlur = 8;
    this.ctx.fillStyle = '#00FF66';
    this.ctx.font = '16px "Press Start 2P", monospace';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';
    this.ctx.fillText(`${this.score}`, 12, 14);
    this.ctx.shadowBlur = 0;
    
    this.ctx.fillStyle = 'rgba(0, 255, 100, 0.4)';
    this.ctx.font = '8px "Press Start 2P", monospace';
    this.ctx.fillText('STANK', 12, 8);
    
    this.ctx.shadowColor = '#00FF66';
    this.ctx.shadowBlur = 6;
    this.ctx.fillStyle = '#00FF66';
    this.ctx.font = '12px "Press Start 2P", monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`LVL ${this.level}`, this.canvas.width / 2, 16);
    this.ctx.shadowBlur = 0;
    
    this.ctx.fillStyle = '#FFD700';
    this.ctx.textAlign = 'right';
    this.ctx.fillText(`${this.linesCleared} LINES`, this.canvas.width - 12, 14);
    
    if (this.combo >= 2) {
      this.ctx.shadowColor = '#FFD700';
      this.ctx.shadowBlur = 10;
      this.ctx.fillStyle = '#FFD700';
      this.ctx.font = '14px "Press Start 2P", monospace';
      this.ctx.fillText(`${this.combo}x`, this.canvas.width - 12, 32);
      this.ctx.shadowBlur = 0;
      
      this.ctx.fillStyle = 'rgba(255, 215, 0, 0.5)';
      this.ctx.font = '8px "Press Start 2P", monospace';
      this.ctx.fillText('COMBO', this.canvas.width - 12, 48);
    }
    
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    this.ctx.font = '9px "Press Start 2P", monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('ARROWS: MOVE', this.canvas.width / 2, this.canvas.height - 60);
    this.ctx.fillText('P: PAUSE', this.canvas.width / 2, this.canvas.height - 48);
  }
  
  private renderGameOver() {
    this.ctx.fillStyle = 'rgba(5, 2, 10, 0.9)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.ctx.shadowColor = '#FF4444';
    this.ctx.shadowBlur = 20;
    this.ctx.fillStyle = '#FF4444';
    this.ctx.font = '32px "Press Start 2P", monospace';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2 - 50);
    this.ctx.shadowBlur = 0;
    
    this.ctx.fillStyle = '#FFD700';
    this.ctx.font = '14px "Press Start 2P", monospace';
    this.ctx.fillText(`FINAL SCORE: ${this.score}`, this.canvas.width / 2, this.canvas.height / 2 + 20);
    this.ctx.fillText(`LINES: ${this.linesCleared}`, this.canvas.width / 2, this.canvas.height / 2 + 50);
    this.ctx.fillText(`LVL ${this.level}`, this.canvas.width / 2, this.canvas.height / 2 + 80);
    
    this.ctx.fillStyle = 'rgba(0, 255, 100, 0.8)';
    this.ctx.font = '10px "Press Start 2P", monospace';
    this.ctx.fillText('PRESS ENTER TO RESTART', this.canvas.width / 2, this.canvas.height / 2 + 120);
  }
  
  private renderOverlay(title: string, ...lines: string[]) {
    this.ctx.fillStyle = 'rgba(5, 2, 10, 0.85)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.ctx.shadowColor = '#00FF66';
    this.ctx.shadowBlur = 15;
    this.ctx.fillStyle = '#00FF66';
    this.ctx.font = '28px "Press Start 2P", monospace';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(title, this.canvas.width / 2, this.canvas.height / 2 - 60);
    this.ctx.shadowBlur = 0;
    
    this.ctx.font = '12px "Press Start 2P", monospace';
    lines.forEach((line, i) => {
      this.ctx.fillStyle = i === 0 ? '#FFD700' : '#88AA88';
      this.ctx.fillText(line, this.canvas.width / 2, this.canvas.height / 2 + 20 + i * 24);
    });
  }
  
  public restart() {
    this.reset();
    this.start();
  }
}
