import { GameEngine } from './GameEngine';

interface Bullet {
  x: number;
  y: number;
  width: number;
  height: number;
  vy: number;
  isEnemy: boolean;
}

interface Invader {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'blunt' | 'leaf' | 'doobie';
  points: number;
  alive: boolean;
  frame: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface SmokeWisp {
  x: number;
  y: number;
  size: number;
  speed: number;
  alpha: number;
  drift: number;
  phase: number;
}

export class ChronicInvadersGame extends GameEngine {
  // Player
  private playerX = 0;
  private playerY = 0;
  private playerWidth = 36;
  private playerHeight = 20;
  private playerSpeed = 5;
  private playerLives = 3;
  private playerInvincible = 0;

  // Bullets
  private playerBullets: Bullet[] = [];
  private enemyBullets: Bullet[] = [];
  private playerBulletSpeed = 7;
  private enemyBulletSpeed = 3;
  private lastShot = 0;
  private shotCooldown = 250;

  // Invaders
  private invaders: Invader[] = [];
  private invaderDirection = 1;
  private invaderSpeed = 1;
  private invaderDropAmount = 16;
  private invaderRows = 5;
  private invaderCols = 8;
  private invaderFrame = 0;
  private invaderMoveTimer = 0;
  private invaderMoveInterval = 60;
  private invaderShootTimer = 0;
  private invaderShootInterval = 40;

  // Particles
  private particles: Particle[] = [];
  private smokeWisps: SmokeWisp[] = [];

  // Scoring
  private score = 0;
  private highScore = 0;
  private wave = 1;

  // State
  private keysPressed: Set<string> = new Set();
  private time = 0;

  constructor(canvas: HTMLCanvasElement) {
    super(canvas);
    this.highScore = this.loadHighScore();
    this.initSmoke();
    this.initializeGame();
  }

  private loadHighScore(): number {
    try {
      return parseInt(localStorage.getItem('chronic_highscore') || '0', 10);
    } catch {
      return 0;
    }
  }

  private saveHighScore(): void {
    try {
      localStorage.setItem('chronic_highscore', String(this.highScore));
    } catch {
      // ignore
    }
  }

  private initSmoke(): void {
    this.smokeWisps = [];
    for (let i = 0; i < 10; i++) {
      this.smokeWisps.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        size: 20 + Math.random() * 40,
        speed: 0.1 + Math.random() * 0.3,
        alpha: 0.02 + Math.random() * 0.04,
        drift: (Math.random() - 0.5) * 0.3,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  private initializeGame(): void {
    this.playerX = this.canvas.width / 2 - this.playerWidth / 2;
    this.playerY = this.canvas.height - 40;
    this.playerLives = 3;
    this.playerInvincible = 0;
    this.playerBullets = [];
    this.enemyBullets = [];
    this.particles = [];
    this.score = 0;
    this.wave = 1;
    this.invaderDirection = 1;
    this.invaderSpeed = 1;
    this.invaderMoveInterval = 60;
    this.invaderFrame = 0;
    this.invaderMoveTimer = 0;
    this.invaderShootTimer = 0;
    this.spawnInvaders();
    this.gameState = 'running';
  }

  private spawnInvaders(): void {
    this.invaders = [];
    const types: Array<{ type: Invader['type']; points: number }> = [
      { type: 'doobie', points: 30 },
      { type: 'doobie', points: 30 },
      { type: 'leaf', points: 20 },
      { type: 'leaf', points: 20 },
      { type: 'blunt', points: 10 },
    ];

    const totalWidth = this.invaderCols * 44;
    const startX = (this.canvas.width - totalWidth) / 2;
    const startY = 50;

    for (let row = 0; row < this.invaderRows; row++) {
      const info = types[row] || types[4];
      for (let col = 0; col < this.invaderCols; col++) {
        this.invaders.push({
          x: startX + col * 44,
          y: startY + row * 32,
          width: 28,
          height: 20,
          type: info.type,
          points: info.points,
          alive: true,
          frame: 0,
        });
      }
    }
  }

  protected handleKeyDown(event: KeyboardEvent): void {
    this.keysPressed.add(event.code);

    if (this.gameState === 'gameover') {
      if (event.code === 'Enter' || event.code === 'Space') {
        this.restart();
      }
      return;
    }

    if (event.code === 'Space') {
      this.shoot();
      event.preventDefault();
    }

    if (event.code === 'KeyP') {
      if (this.gameState === 'running') {
        this.pause();
      } else if (this.gameState === 'paused') {
        this.resume();
      }
    }
  }

  protected handleTouchStart(event: TouchEvent): void {
    if (event.touches.length > 0) {
      const touch = event.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const touchX = (touch.clientX - rect.left) * (this.canvas.width / rect.width);

      // Move toward touch
      const centerX = this.playerX + this.playerWidth / 2;
      if (touchX < centerX - 10) {
        this.keysPressed.add('ArrowLeft');
        this.keysPressed.delete('ArrowRight');
      } else if (touchX > centerX + 10) {
        this.keysPressed.add('ArrowRight');
        this.keysPressed.delete('ArrowLeft');
      }

      // Tap to shoot
      this.shoot();
    }
  }

  protected handleTouchMove(event: TouchEvent): void {
    if (event.touches.length > 0) {
      const touch = event.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const touchX = (touch.clientX - rect.left) * (this.canvas.width / rect.width);

      this.keysPressed.delete('ArrowLeft');
      this.keysPressed.delete('ArrowRight');

      const centerX = this.playerX + this.playerWidth / 2;
      if (touchX < centerX - 5) {
        this.keysPressed.add('ArrowLeft');
      } else if (touchX > centerX + 5) {
        this.keysPressed.add('ArrowRight');
      }
    }
  }

  private shoot(): void {
    if (this.gameState !== 'running') return;
    const now = Date.now();
    if (now - this.lastShot < this.shotCooldown) return;
    this.lastShot = now;

    this.playerBullets.push({
      x: this.playerX + this.playerWidth / 2 - 1.5,
      y: this.playerY - 8,
      width: 3,
      height: 10,
      vy: -this.playerBulletSpeed,
      isEnemy: false,
    });
  }

  protected update(deltaTime: number): void {
    if (this.gameState !== 'running') return;

    this.time += deltaTime || 16;

    // Player movement
    if (this.keysPressed.has('ArrowLeft') || this.keysPressed.has('KeyA')) {
      this.playerX = Math.max(4, this.playerX - this.playerSpeed);
    }
    if (this.keysPressed.has('ArrowRight') || this.keysPressed.has('KeyD')) {
      this.playerX = Math.min(this.canvas.width - this.playerWidth - 4, this.playerX + this.playerSpeed);
    }

    // Invincibility timer
    if (this.playerInvincible > 0) {
      this.playerInvincible--;
    }

    // Update player bullets
    for (let i = this.playerBullets.length - 1; i >= 0; i--) {
      this.playerBullets[i].y += this.playerBullets[i].vy;
      if (this.playerBullets[i].y < -10) {
        this.playerBullets.splice(i, 1);
      }
    }

    // Update enemy bullets
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      this.enemyBullets[i].y += this.enemyBullets[i].vy;
      if (this.enemyBullets[i].y > this.canvas.height + 10) {
        this.enemyBullets.splice(i, 1);
      }
    }

    // Move invaders
    this.invaderMoveTimer++;
    if (this.invaderMoveTimer >= this.invaderMoveInterval) {
      this.invaderMoveTimer = 0;
      this.invaderFrame = 1 - this.invaderFrame;
      this.moveInvaders();
    }

    // Invader shooting
    this.invaderShootTimer++;
    if (this.invaderShootTimer >= this.invaderShootInterval) {
      this.invaderShootTimer = 0;
      this.enemyShoot();
    }

    // Collision: player bullets vs invaders
    for (let bi = this.playerBullets.length - 1; bi >= 0; bi--) {
      const b = this.playerBullets[bi];
      for (const inv of this.invaders) {
        if (!inv.alive) continue;
        if (
          b.x < inv.x + inv.width &&
          b.x + b.width > inv.x &&
          b.y < inv.y + inv.height &&
          b.y + b.height > inv.y
        ) {
          inv.alive = false;
          this.score += inv.points;
          if (this.score > this.highScore) {
            this.highScore = this.score;
            this.saveHighScore();
          }
          this.spawnExplosion(inv.x + inv.width / 2, inv.y + inv.height / 2, inv.type);
          this.playerBullets.splice(bi, 1);
          break;
        }
      }
    }

    // Collision: enemy bullets vs player
    if (this.playerInvincible <= 0) {
      for (let bi = this.enemyBullets.length - 1; bi >= 0; bi--) {
        const b = this.enemyBullets[bi];
        if (
          b.x < this.playerX + this.playerWidth &&
          b.x + b.width > this.playerX &&
          b.y < this.playerY + this.playerHeight &&
          b.y + b.height > this.playerY
        ) {
          this.enemyBullets.splice(bi, 1);
          this.playerLives--;
          this.playerInvincible = 90;
          this.spawnExplosion(
            this.playerX + this.playerWidth / 2,
            this.playerY + this.playerHeight / 2,
            'blunt'
          );
          if (this.playerLives <= 0) {
            this.gameState = 'gameover';
          }
          break;
        }
      }
    }

    // Collision: invaders reaching player
    for (const inv of this.invaders) {
      if (inv.alive && inv.y + inv.height >= this.playerY) {
        this.gameState = 'gameover';
        break;
      }
    }

    // Check wave clear
    if (this.invaders.every((inv) => !inv.alive)) {
      this.wave++;
      this.invaderSpeed = Math.min(3, 1 + this.wave * 0.2);
      this.invaderMoveInterval = Math.max(20, 60 - this.wave * 5);
      this.invaderShootInterval = Math.max(15, 40 - this.wave * 3);
      this.spawnInvaders();
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05;
      p.life--;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Update smoke
    for (const s of this.smokeWisps) {
      s.y -= s.speed;
      s.x += Math.sin(this.time * 0.001 + s.phase) * s.drift;
      if (s.y + s.size < 0) {
        s.y = this.canvas.height + s.size;
        s.x = Math.random() * this.canvas.width;
      }
    }
  }

  private moveInvaders(): void {
    let hitEdge = false;
    const alive = this.invaders.filter((inv) => inv.alive);

    for (const inv of alive) {
      inv.x += this.invaderSpeed * this.invaderDirection * 8;
      if (inv.x + inv.width > this.canvas.width - 4 || inv.x < 4) {
        hitEdge = true;
      }
    }

    if (hitEdge) {
      this.invaderDirection *= -1;
      for (const inv of alive) {
        inv.y += this.invaderDropAmount;
      }
    }
  }

  private enemyShoot(): void {
    const alive = this.invaders.filter((inv) => inv.alive);
    if (alive.length === 0) return;

    // Pick a random invader from the bottom row of each column
    const columns = new Map<number, Invader>();
    for (const inv of alive) {
      const col = Math.round(inv.x / 44);
      const existing = columns.get(col);
      if (!existing || inv.y > existing.y) {
        columns.set(col, inv);
      }
    }

    const bottomRow = Array.from(columns.values());
    const shooter = bottomRow[Math.floor(Math.random() * bottomRow.length)];

    this.enemyBullets.push({
      x: shooter.x + shooter.width / 2 - 1.5,
      y: shooter.y + shooter.height,
      width: 3,
      height: 8,
      vy: this.enemyBulletSpeed + this.wave * 0.3,
      isEnemy: true,
    });
  }

  private spawnExplosion(x: number, y: number, type: Invader['type']): void {
    const colors: Record<string, string[]> = {
      blunt: ['#8B4513', '#FF6600', '#FFAA00', '#FF4400'],
      leaf: ['#1B5E20', '#2E7D32', '#4CAF50', '#00FF66'],
      doobie: ['#F5F5DC', '#FF4400', '#FF6600', '#FFAA00'],
    };
    const palette = colors[type] || colors.blunt;

    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12 + Math.random() * 0.5;
      const speed = 1 + Math.random() * 3;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 20 + Math.random() * 20,
        maxLife: 40,
        color: palette[Math.floor(Math.random() * palette.length)],
        size: 2 + Math.random() * 3,
      });
    }
  }

  protected render(): void {
    // Background
    this.ctx.fillStyle = '#0a0612';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // CRT grid lines
    this.ctx.strokeStyle = 'rgba(0, 255, 100, 0.03)';
    this.ctx.lineWidth = 1;
    for (let y = 0; y < this.canvas.height; y += 4) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
      this.ctx.stroke();
    }

    // Smoke wisps
    this.renderSmoke();

    // Ground line
    this.ctx.strokeStyle = '#00FF66';
    this.ctx.lineWidth = 1;
    this.ctx.globalAlpha = 0.3;
    this.ctx.beginPath();
    this.ctx.moveTo(0, this.canvas.height - 16);
    this.ctx.lineTo(this.canvas.width, this.canvas.height - 16);
    this.ctx.stroke();
    this.ctx.globalAlpha = 1;

    // Invaders
    this.renderInvaders();

    // Player
    if (this.gameState !== 'gameover') {
      this.renderPlayer();
    }

    // Bullets
    this.renderBullets();

    // Particles
    this.renderParticles();

    // HUD
    this.renderHUD();

    // Game over overlay
    if (this.gameState === 'gameover') {
      this.renderOverlay('GAME OVER', `SCORE: ${this.score}`, 'PRESS ENTER TO RESTART');
    }

    // Paused overlay
    if (this.gameState === 'paused') {
      this.renderOverlay('PAUSED', 'PRESS P TO RESUME');
    }

    // CRT vignette
    this.renderCRT();
  }

  private renderSmoke(): void {
    for (const s of this.smokeWisps) {
      const g = this.ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.size);
      g.addColorStop(0, `rgba(100, 160, 100, ${s.alpha})`);
      g.addColorStop(1, 'rgba(100, 160, 100, 0)');
      this.ctx.fillStyle = g;
      this.ctx.beginPath();
      this.ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  private renderInvaders(): void {
    for (const inv of this.invaders) {
      if (!inv.alive) continue;

      const cx = inv.x + inv.width / 2;
      const cy = inv.y + inv.height / 2;

      if (inv.type === 'blunt') {
        this.renderBlunt(inv);
      } else if (inv.type === 'leaf') {
        this.renderLeaf(cx, cy, inv.frame);
      } else if (inv.type === 'doobie') {
        this.renderDoobie(inv);
      }
    }
  }

  private renderBlunt(inv: Invader): void {
    const { x, y, width, height, frame } = inv;

    // Body
    this.ctx.fillStyle = '#8B4513';
    this.ctx.fillRect(x + 2, y + 2, width - 4, height - 4);

    // Wrapper lines
    this.ctx.strokeStyle = '#6B3410';
    this.ctx.lineWidth = 0.5;
    for (let i = 0; i < 3; i++) {
      const ly = y + 4 + i * 5;
      this.ctx.beginPath();
      this.ctx.moveTo(x + 3, ly);
      this.ctx.lineTo(x + width - 3, ly);
      this.ctx.stroke();
    }

    // Ember (lit end) — pulsing
    const emberGlow = 0.6 + Math.sin(this.time * 0.008 + inv.x) * 0.4;
    this.ctx.fillStyle = `rgba(255, ${100 + Math.floor(emberGlow * 100)}, 0, ${emberGlow})`;
    this.ctx.beginPath();
    this.ctx.arc(x + 3, y + height / 2, 3, 0, Math.PI * 2);
    this.ctx.fill();

    // Eyes (invader face)
    const eyeOff = frame === 0 ? 0 : 1;
    this.ctx.fillStyle = '#FF0000';
    this.ctx.fillRect(x + width * 0.4, y + height * 0.25 + eyeOff, 2, 2);
    this.ctx.fillRect(x + width * 0.65, y + height * 0.25 + eyeOff, 2, 2);

    // Legs (frame animation)
    this.ctx.fillStyle = '#5C2D0A';
    const legY = frame === 0 ? 0 : 2;
    this.ctx.fillRect(x + 4, y + height - 2 + legY, 3, 3);
    this.ctx.fillRect(x + width - 7, y + height - 2 + legY, 3, 3);
    this.ctx.fillRect(x + width * 0.4, y + height - 2 + (2 - legY), 3, 3);
  }

  private renderLeaf(cx: number, cy: number, frame: number): void {
    this.ctx.save();
    this.ctx.translate(cx, cy);
    this.ctx.rotate(frame === 0 ? -0.1 : 0.1);

    // Leaf body
    this.ctx.fillStyle = '#1B5E20';
    this.ctx.beginPath();
    this.ctx.moveTo(0, -10);
    this.ctx.quadraticCurveTo(8, -6, 12, 0);
    this.ctx.quadraticCurveTo(8, 2, 6, 8);
    this.ctx.lineTo(0, 6);
    this.ctx.lineTo(-6, 8);
    this.ctx.quadraticCurveTo(-8, 2, -12, 0);
    this.ctx.quadraticCurveTo(-8, -6, 0, -10);
    this.ctx.fill();

    // Vein
    this.ctx.strokeStyle = '#2E7D32';
    this.ctx.lineWidth = 0.8;
    this.ctx.beginPath();
    this.ctx.moveTo(0, -8);
    this.ctx.lineTo(0, 6);
    this.ctx.stroke();

    // Eyes
    this.ctx.fillStyle = '#FF0000';
    this.ctx.fillRect(-4, -3, 2, 2);
    this.ctx.fillRect(2, -3, 2, 2);

    this.ctx.restore();
  }

  private renderDoobie(inv: Invader): void {
    const { x, y, width, height, frame } = inv;

    // Paper body
    this.ctx.fillStyle = '#F5F5DC';
    this.ctx.beginPath();
    this.ctx.roundRect(x + 1, y + 3, width - 2, height - 6, 3);
    this.ctx.fill();

    // Filter end
    this.ctx.fillStyle = '#D2B48C';
    this.ctx.fillRect(x + width - 6, y + 3, 5, height - 6);

    // Filter lines
    this.ctx.strokeStyle = '#B8956A';
    this.ctx.lineWidth = 0.5;
    for (let i = 0; i < 3; i++) {
      this.ctx.beginPath();
      this.ctx.moveTo(x + width - 5, y + 5 + i * 4);
      this.ctx.lineTo(x + width - 2, y + 5 + i * 4);
      this.ctx.stroke();
    }

    // Ember
    const pulse = 0.5 + Math.sin(this.time * 0.01 + inv.y) * 0.5;
    this.ctx.fillStyle = `rgba(255, 68, 0, ${pulse})`;
    this.ctx.beginPath();
    this.ctx.arc(x + 3, y + height / 2, 2.5, 0, Math.PI * 2);
    this.ctx.fill();

    // Eyes
    const eyeOff = frame === 0 ? 0 : 1;
    this.ctx.fillStyle = '#FF0000';
    this.ctx.fillRect(x + width * 0.3, y + height * 0.3 + eyeOff, 2, 2);
    this.ctx.fillRect(x + width * 0.55, y + height * 0.3 + eyeOff, 2, 2);
  }

  private renderPlayer(): void {
    const blinkOn = this.playerInvincible <= 0 || Math.floor(this.playerInvincible / 3) % 2 === 0;
    if (!blinkOn) return;

    const x = this.playerX;
    const y = this.playerY;
    const w = this.playerWidth;
    const h = this.playerHeight;

    // Ship body — skunk-colored triangular ship
    this.ctx.fillStyle = '#00FF66';
    this.ctx.shadowColor = '#00FF66';
    this.ctx.shadowBlur = 8;

    // Main body
    this.ctx.beginPath();
    this.ctx.moveTo(x + w / 2, y - 2);
    this.ctx.lineTo(x + 4, y + h);
    this.ctx.lineTo(x + w - 4, y + h);
    this.ctx.closePath();
    this.ctx.fill();

    // Cockpit
    this.ctx.fillStyle = '#00CC55';
    this.ctx.beginPath();
    this.ctx.arc(x + w / 2, y + h * 0.45, 4, 0, Math.PI * 2);
    this.ctx.fill();

    // Wing tips
    this.ctx.fillStyle = '#00FF88';
    this.ctx.fillRect(x, y + h - 4, 6, 4);
    this.ctx.fillRect(x + w - 6, y + h - 4, 6, 4);

    // Engine glow
    const enginePulse = 0.5 + Math.sin(this.time * 0.02) * 0.3;
    this.ctx.fillStyle = `rgba(255, 165, 0, ${enginePulse})`;
    this.ctx.beginPath();
    this.ctx.moveTo(x + w / 2 - 4, y + h);
    this.ctx.lineTo(x + w / 2, y + h + 6 + Math.random() * 3);
    this.ctx.lineTo(x + w / 2 + 4, y + h);
    this.ctx.fill();

    this.ctx.shadowBlur = 0;
  }

  private renderBullets(): void {
    // Player bullets — bright yellow/gold
    for (const b of this.playerBullets) {
      this.ctx.fillStyle = '#FFD700';
      this.ctx.shadowColor = '#FFD700';
      this.ctx.shadowBlur = 6;
      this.ctx.fillRect(b.x, b.y, b.width, b.height);
      // Trail
      this.ctx.fillStyle = 'rgba(255, 215, 0, 0.3)';
      this.ctx.fillRect(b.x, b.y + b.height, b.width, 6);
    }

    // Enemy bullets — red/orange zigzag
    for (const b of this.enemyBullets) {
      this.ctx.fillStyle = '#FF4444';
      this.ctx.shadowColor = '#FF4444';
      this.ctx.shadowBlur = 4;
      // Zigzag bullet
      this.ctx.beginPath();
      this.ctx.moveTo(b.x, b.y);
      this.ctx.lineTo(b.x + b.width, b.y + 2);
      this.ctx.lineTo(b.x, b.y + 4);
      this.ctx.lineTo(b.x + b.width, b.y + 6);
      this.ctx.lineTo(b.x, b.y + 8);
      this.ctx.fill();
    }

    this.ctx.shadowBlur = 0;
  }

  private renderParticles(): void {
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      this.ctx.globalAlpha = alpha;
      this.ctx.fillStyle = p.color;
      this.ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    this.ctx.globalAlpha = 1;
  }

  private renderHUD(): void {
    // Score
    this.ctx.shadowColor = '#00FF66';
    this.ctx.shadowBlur = 8;
    this.ctx.fillStyle = '#00FF66';
    this.ctx.font = '14px "Press Start 2P", monospace';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';
    this.ctx.fillText(`SCORE`, 10, 8);
    this.ctx.font = '16px "Press Start 2P", monospace';
    this.ctx.fillText(`${this.score}`, 10, 26);
    this.ctx.shadowBlur = 0;

    // High score
    this.ctx.fillStyle = 'rgba(0, 255, 100, 0.4)';
    this.ctx.font = '8px "Press Start 2P", monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`HI: ${this.highScore}`, this.canvas.width / 2, 8);

    // Wave
    this.ctx.shadowColor = '#00FF66';
    this.ctx.shadowBlur = 6;
    this.ctx.fillStyle = '#00FF66';
    this.ctx.font = '10px "Press Start 2P", monospace';
    this.ctx.fillText(`WAVE ${this.wave}`, this.canvas.width / 2, 22);
    this.ctx.shadowBlur = 0;

    // Lives
    this.ctx.fillStyle = '#00FF66';
    this.ctx.font = '10px "Press Start 2P", monospace';
    this.ctx.textAlign = 'right';
    this.ctx.fillText('LIVES', this.canvas.width - 10, 8);

    // Life indicators (small ships)
    for (let i = 0; i < this.playerLives; i++) {
      const lx = this.canvas.width - 18 - i * 20;
      const ly = 24;
      this.ctx.fillStyle = '#00FF66';
      this.ctx.beginPath();
      this.ctx.moveTo(lx, ly);
      this.ctx.lineTo(lx - 6, ly + 10);
      this.ctx.lineTo(lx + 6, ly + 10);
      this.ctx.closePath();
      this.ctx.fill();
    }

    // Start prompt when not started
    if (this.gameState === 'running' && this.time < 2000) {
      const alpha = Math.max(0, 1 - this.time / 2000);
      this.ctx.globalAlpha = alpha;
      this.ctx.shadowColor = '#00FF66';
      this.ctx.shadowBlur = 10;
      this.ctx.fillStyle = '#00FF66';
      this.ctx.font = '12px "Press Start 2P", monospace';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('SPACE TO SHOOT', this.canvas.width / 2, this.canvas.height / 2);
      this.ctx.fillText('ARROWS TO MOVE', this.canvas.width / 2, this.canvas.height / 2 + 22);
      this.ctx.shadowBlur = 0;
      this.ctx.globalAlpha = 1;
    }
  }

  private renderOverlay(title: string, ...lines: string[]): void {
    this.ctx.fillStyle = 'rgba(5, 2, 10, 0.82)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.shadowColor = '#00FF66';
    this.ctx.shadowBlur = 20;
    this.ctx.fillStyle = '#00FF66';
    this.ctx.font = '28px "Press Start 2P", monospace';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(title, this.canvas.width / 2, this.canvas.height / 2 - 40);
    this.ctx.shadowBlur = 0;

    this.ctx.font = '14px "Press Start 2P", monospace';
    lines.forEach((line, i) => {
      this.ctx.fillStyle = i === 0 ? '#FFD700' : '#88AA88';
      this.ctx.fillText(line, this.canvas.width / 2, this.canvas.height / 2 + 20 + i * 28);
    });
  }

  private renderCRT(): void {
    // Scanline overlay
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
    for (let y = 0; y < this.canvas.height; y += 3) {
      this.ctx.fillRect(0, y, this.canvas.width, 1);
    }

    // Vignette
    const g = this.ctx.createRadialGradient(
      this.canvas.width / 2,
      this.canvas.height / 2,
      this.canvas.width * 0.35,
      this.canvas.width / 2,
      this.canvas.height / 2,
      this.canvas.width * 0.7
    );
    g.addColorStop(0, 'rgba(0, 0, 0, 0)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
    this.ctx.fillStyle = g;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  public restart(): void {
    this.keysPressed.clear();
    this.initializeGame();
    this.start();
  }
}
