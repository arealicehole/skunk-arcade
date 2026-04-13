import { GameEngine } from './GameEngine';

type Position = { x: number; y: number };
type Velocity = { x: number; y: number };

interface Brick {
  x: number;
  y: number;
  width: number;
  height: number;
  hits: number;        // remaining hits before destroyed
  maxHits: number;     // max hits (determines tier)
  points: number;
  color: string;
  hitColor: string;
  destroyed: boolean;
}

interface Ball {
  pos: Position;
  vel: Velocity;
  radius: number;
  fireball: boolean;
  fireballTimer: number;
}

interface PowerUp {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'wide' | 'multi' | 'fire';
  vy: number;
  color: string;
  label: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: number[];
  size: number;
}

export class HashBashGame extends GameEngine {
  // Paddle (pipe)
  private paddleWidth = 90;
  private paddleHeight = 16;
  private paddleX = 0;
  private paddleY = 0;
  private paddleSpeed = 8;
  private basePaddleWidth = 90;
  private widePaddleTimer = 0;

  // Balls
  private balls: Ball[] = [];
  private baseBallSpeed = 4.5;
  private ballRadius = 8;

  // Bricks
  private bricks: Brick[] = [];
  private brickRows = 5;
  private brickCols = 8;
  private brickPadding = 6;
  private brickOffsetTop = 50;
  private brickOffsetLeft = 30;

  // Power-ups
  private powerUps: PowerUp[] = [];
  private powerUpSpeed = 2;
  private powerUpChance = 0.15;
  private powerUpWidth = 28;
  private powerUpHeight = 14;

  // Particles (for brick break effects)
  private particles: Particle[] = [];

  // Scoring
  private score = 0;
  private combo = 0;
  private comboTimer = 0;
  private level = 1;

  // State
  private launched = false;
  private keysPressed: Set<string> = new Set();
  private starField: { x: number; y: number; size: number; brightness: number }[] = [];

  // Pulsing glow for hash ball
  private glowPhase = 0;

  constructor(canvas: HTMLCanvasElement) {
    super(canvas);
    this.generateStarField();
    this.initializeGame();
  }

  private generateStarField() {
    this.starField = [];
    for (let i = 0; i < 40; i++) {
      this.starField.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        size: Math.random() * 2 + 0.5,
        brightness: Math.random() * 0.4 + 0.1,
      });
    }
  }

  private initializeGame() {
    // Paddle position
    this.paddleY = this.canvas.height - 40;
    this.paddleX = (this.canvas.width - this.paddleWidth) / 2;
    this.paddleWidth = this.basePaddleWidth;
    this.widePaddleTimer = 0;

    // Reset balls
    this.balls = [this.createBall()];
    this.launched = false;

    // Generate bricks
    this.generateBricks();

    // Clear power-ups and particles
    this.powerUps = [];
    this.particles = [];

    // Reset scoring
    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.level = 1;

    this.gameState = 'running';
  }

  private createBall(): Ball {
    return {
      pos: { x: this.paddleX + this.paddleWidth / 2, y: this.paddleY - this.ballRadius - 2 },
      vel: { x: 0, y: 0 },
      radius: this.ballRadius,
      fireball: false,
      fireballTimer: 0,
    };
  }

  private generateBricks() {
    this.bricks = [];
    const totalPadding = this.brickOffsetLeft * 2 + this.brickPadding * (this.brickCols - 1);
    const brickWidth = (this.canvas.width - totalPadding) / this.brickCols;
    const brickHeight = 22;

    const tiers = [
      { maxHits: 3, points: 30, color: '#8B0000', hitColor: '#CC4444', label: 'Bong' },       // Row 0-1: Bongs (3 hits) - deep red
      { maxHits: 2, points: 20, color: '#2E8B57', hitColor: '#66BB6A', label: 'Blunt' },       // Row 2-3: Blunts (2 hits) - green
      { maxHits: 1, points: 10, color: '#DAA520', hitColor: '#FFD54F', label: 'Doobie' },      // Row 4: Doobies (1 hit) - gold
    ];

    for (let row = 0; row < this.brickRows; row++) {
      const tier = row < 2 ? tiers[0] : row < 4 ? tiers[1] : tiers[2];
      for (let col = 0; col < this.brickCols; col++) {
        this.bricks.push({
          x: this.brickOffsetLeft + col * (brickWidth + this.brickPadding),
          y: this.brickOffsetTop + row * (brickHeight + this.brickPadding),
          width: brickWidth,
          height: brickHeight,
          hits: tier.maxHits,
          maxHits: tier.maxHits,
          points: tier.points,
          color: tier.color,
          hitColor: tier.hitColor,
          destroyed: false,
        });
      }
    }
  }

  protected setupEventListeners() {
    super.setupEventListeners();
    window.addEventListener('keyup', this.handleKeyUp.bind(this));
  }

  public cleanup() {
    super.cleanup();
    window.removeEventListener('keyup', this.handleKeyUp.bind(this));
  }

  protected handleKeyDown(event: KeyboardEvent) {
    this.keysPressed.add(event.key);

    if (this.gameState === 'gameover' || this.gameState === 'paused') {
      if (event.key === 'Enter') {
        this.restart();
      }
      return;
    }

    // Launch ball on Space or ArrowUp
    if (!this.launched && (event.key === ' ' || event.key === 'ArrowUp')) {
      this.launchBall();
    }

    // Pause on P
    if (event.key === 'p' || event.key === 'P') {
      if (this.gameState === 'running') {
        this.pause();
      } else if (this.gameState === 'paused') {
        this.resume();
      }
    }
  }

  private handleKeyUp(event: KeyboardEvent) {
    this.keysPressed.delete(event.key);
  }

  private launchBall() {
    if (this.launched) return;
    this.launched = true;
    const speed = this.baseBallSpeed + (this.level - 1) * 0.3;
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.6; // mostly upward, slight random angle
    this.balls[0].vel = {
      x: speed * Math.cos(angle),
      y: speed * Math.sin(angle),
    };
  }

  protected update(deltaTime: number) {
    if (this.gameState !== 'running') return;

    this.glowPhase += deltaTime * 0.005;

    // Combo decay
    this.comboTimer -= deltaTime;
    if (this.comboTimer <= 0) {
      this.combo = 0;
    }

    // Wide paddle decay
    if (this.widePaddleTimer > 0) {
      this.widePaddleTimer -= deltaTime;
      if (this.widePaddleTimer <= 0) {
        this.paddleWidth = this.basePaddleWidth;
      }
    }

    // Move paddle
    this.updatePaddle();

    // Update balls
    if (!this.launched) {
      // Ball follows paddle before launch
      this.balls[0].pos.x = this.paddleX + this.paddleWidth / 2;
      this.balls[0].pos.y = this.paddleY - this.ballRadius - 2;
    } else {
      this.updateBalls();
    }

    // Update power-ups
    this.updatePowerUps();

    // Update particles
    this.updateParticles(deltaTime);

    // Check win condition
    if (this.bricks.every(b => b.destroyed)) {
      this.level++;
      this.generateBricks();
      this.launched = false;
      this.balls = [this.createBall()];
      this.powerUps = [];
    }
  }

  private updatePaddle() {
    if (this.keysPressed.has('ArrowLeft') || this.keysPressed.has('a')) {
      this.paddleX = Math.max(0, this.paddleX - this.paddleSpeed);
    }
    if (this.keysPressed.has('ArrowRight') || this.keysPressed.has('d')) {
      this.paddleX = Math.min(this.canvas.width - this.paddleWidth, this.paddleX + this.paddleSpeed);
    }
  }

  private updateBalls() {
    const deadBalls: number[] = [];

    for (let i = this.balls.length - 1; i >= 0; i--) {
      const ball = this.balls[i];

      // Fireball decay
      if (ball.fireball) {
        ball.fireballTimer -= 16;
        if (ball.fireballTimer <= 0) {
          ball.fireball = false;
        }
      }

      ball.pos.x += ball.vel.x;
      ball.pos.y += ball.vel.y;

      // Wall collisions
      if (ball.pos.x - ball.radius <= 0) {
        ball.pos.x = ball.radius;
        ball.vel.x = Math.abs(ball.vel.x);
      }
      if (ball.pos.x + ball.radius >= this.canvas.width) {
        ball.pos.x = this.canvas.width - ball.radius;
        ball.vel.x = -Math.abs(ball.vel.x);
      }
      if (ball.pos.y - ball.radius <= 0) {
        ball.pos.y = ball.radius;
        ball.vel.y = Math.abs(ball.vel.y);
      }

      // Bottom - ball lost
      if (ball.pos.y + ball.radius > this.canvas.height) {
        deadBalls.push(i);
        continue;
      }

      // Paddle collision
      if (
        ball.vel.y > 0 &&
        ball.pos.y + ball.radius >= this.paddleY &&
        ball.pos.y + ball.radius <= this.paddleY + this.paddleHeight + 4 &&
        ball.pos.x >= this.paddleX &&
        ball.pos.x <= this.paddleX + this.paddleWidth
      ) {
        // Calculate bounce angle based on where ball hits paddle
        const hitPos = (ball.pos.x - this.paddleX) / this.paddleWidth; // 0 to 1
        const angle = (hitPos - 0.5) * Math.PI * 0.7; // -63 to 63 degrees
        const speed = Math.sqrt(ball.vel.x ** 2 + ball.vel.y ** 2);

        ball.vel.x = speed * Math.sin(angle);
        ball.vel.y = -speed * Math.cos(angle);
        ball.pos.y = this.paddleY - ball.radius;

        // Reset combo on paddle hit
        this.combo = 0;
      }

      // Brick collisions
      for (const brick of this.bricks) {
        if (brick.destroyed) continue;

        if (this.ballBrickCollision(ball, brick)) {
          if (!ball.fireball) {
            // Normal ball: reflect
            this.reflectBall(ball, brick);
          }
          // Fireball: passes through (no reflection)
          brick.hits--;

          // Combo
          this.combo++;
          this.comboTimer = 2000;
          const comboMultiplier = 1 + Math.floor(this.combo / 3) * 0.5;
          this.score += Math.round(brick.points * comboMultiplier);

          // Spawn particles
          this.spawnBrickParticles(brick);

          if (brick.hits <= 0) {
            brick.destroyed = true;
            // Chance to spawn power-up
            if (Math.random() < this.powerUpChance) {
              this.spawnPowerUp(brick.x + brick.width / 2, brick.y + brick.height / 2);
            }
          }

          if (!ball.fireball) break; // Normal ball only hits one brick per frame
        }
      }
    }

    // Remove dead balls
    for (let i = deadBalls.length - 1; i >= 0; i--) {
      this.balls.splice(deadBalls[i], 1);
    }

    // All balls lost
    if (this.balls.length === 0) {
      this.gameState = 'gameover';
    }
  }

  private ballBrickCollision(ball: Ball, brick: Brick): boolean {
    const closestX = Math.max(brick.x, Math.min(ball.pos.x, brick.x + brick.width));
    const closestY = Math.max(brick.y, Math.min(ball.pos.y, brick.y + brick.height));
    const dx = ball.pos.x - closestX;
    const dy = ball.pos.y - closestY;
    return dx * dx + dy * dy <= ball.radius * ball.radius;
  }

  private reflectBall(ball: Ball, brick: Brick) {
    // Determine which side was hit
    const brickCenterX = brick.x + brick.width / 2;
    const brickCenterY = brick.y + brick.height / 2;
    const dx = ball.pos.x - brickCenterX;
    const dy = ball.pos.y - brickCenterY;

    if (Math.abs(dx / brick.width) > Math.abs(dy / brick.height)) {
      ball.vel.x = dx > 0 ? Math.abs(ball.vel.x) : -Math.abs(ball.vel.x);
    } else {
      ball.vel.y = dy > 0 ? Math.abs(ball.vel.y) : -Math.abs(ball.vel.y);
    }
  }

  private spawnBrickParticles(brick: Brick) {
    const colors = brick.maxHits === 3
      ? [[200, 50, 50], [255, 100, 100], [139, 0, 0]]
      : brick.maxHits === 2
        ? [[46, 139, 87], [100, 200, 100], [34, 120, 60]]
        : [[218, 165, 32], [255, 215, 0], [200, 150, 20]];

    for (let i = 0; i < 8; i++) {
      this.particles.push({
        x: brick.x + Math.random() * brick.width,
        y: brick.y + Math.random() * brick.height,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4 - 1,
        life: 1,
        maxLife: 1,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 4 + 2,
      });
    }
  }

  private spawnPowerUp(x: number, y: number) {
    const types: { type: PowerUp['type']; color: string; label: string }[] = [
      { type: 'wide', color: '#00FF88', label: 'W' },
      { type: 'multi', color: '#FF8800', label: 'M' },
      { type: 'fire', color: '#FF2222', label: 'F' },
    ];
    const chosen = types[Math.floor(Math.random() * types.length)];
    this.powerUps.push({
      x: x - this.powerUpWidth / 2,
      y,
      width: this.powerUpWidth,
      height: this.powerUpHeight,
      type: chosen.type,
      vy: this.powerUpSpeed,
      color: chosen.color,
      label: chosen.label,
    });
  }

  private updatePowerUps() {
    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const pu = this.powerUps[i];
      pu.y += pu.vy;

      // Off screen
      if (pu.y > this.canvas.height) {
        this.powerUps.splice(i, 1);
        continue;
      }

      // Paddle collision
      if (
        pu.y + pu.height >= this.paddleY &&
        pu.y <= this.paddleY + this.paddleHeight &&
        pu.x + pu.width >= this.paddleX &&
        pu.x <= this.paddleX + this.paddleWidth
      ) {
        this.applyPowerUp(pu.type);
        this.powerUps.splice(i, 1);
      }
    }
  }

  private applyPowerUp(type: PowerUp['type']) {
    switch (type) {
      case 'wide':
        this.paddleWidth = this.basePaddleWidth * 1.6;
        this.widePaddleTimer = 8000;
        break;
      case 'multi':
        if (this.balls.length > 0 && this.balls.length < 5) {
          const refBall = this.balls[0];
          for (let i = 0; i < 2; i++) {
            const angle = Math.atan2(refBall.vel.y, refBall.vel.x) + (i === 0 ? 0.5 : -0.5);
            const speed = Math.sqrt(refBall.vel.x ** 2 + refBall.vel.y ** 2);
            this.balls.push({
              pos: { x: refBall.pos.x, y: refBall.pos.y },
              vel: { x: speed * Math.cos(angle), y: speed * Math.sin(angle) },
              radius: this.ballRadius,
              fireball: false,
              fireballTimer: 0,
            });
          }
        }
        break;
      case 'fire':
        for (const ball of this.balls) {
          ball.fireball = true;
          ball.fireballTimer = 6000;
        }
        break;
    }
    this.score += 50; // Bonus for collecting power-up
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1; // gravity
      p.life -= dt * 0.002;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  protected render() {
    // Background
    this.ctx.fillStyle = '#0a0a14';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Star field
    this.renderStarField();

    // Bricks
    this.renderBricks();

    // Power-ups
    this.renderPowerUps();

    // Paddle (pipe)
    this.renderPaddle();

    // Balls
    this.renderBalls();

    // Particles
    this.renderParticles();

    // HUD
    this.renderHUD();

    // Paused overlay
    if (this.gameState === 'paused') {
      this.renderOverlay('PAUSED', 'PRESS P TO RESUME');
    }

    // Game over
    if (this.gameState === 'gameover') {
      this.renderOverlay('GAME OVER', `FINAL SCORE: ${this.score}`, 'PRESS ENTER TO RESTART');
    }
  }

  private renderStarField() {
    for (const star of this.starField) {
      const flicker = Math.sin(this.glowPhase * 2 + star.x) * 0.1 + 0.9;
      this.ctx.fillStyle = `rgba(255, 255, 255, ${star.brightness * flicker})`;
      this.ctx.fillRect(star.x, star.y, star.size, star.size);
    }
  }

  private renderBricks() {
    for (const brick of this.bricks) {
      if (brick.destroyed) continue;

      const isDamaged = brick.hits < brick.maxHits;
      const color = isDamaged ? brick.hitColor : brick.color;

      // Main brick body
      this.ctx.fillStyle = color;
      this.ctx.fillRect(brick.x, brick.y, brick.width, brick.height);

      // Highlight (top-left bevel)
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      this.ctx.fillRect(brick.x, brick.y, brick.width, 3);
      this.ctx.fillRect(brick.x, brick.y, 3, brick.height);

      // Shadow (bottom-right bevel)
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      this.ctx.fillRect(brick.x, brick.y + brick.height - 3, brick.width, 3);
      this.ctx.fillRect(brick.x + brick.width - 3, brick.y, 3, brick.height);

      // Hit indicator dots
      if (brick.maxHits > 1) {
        const dotRadius = 3;
        const dotY = brick.y + brick.height / 2;
        const startX = brick.x + brick.width / 2 - ((brick.maxHits - 1) * 8) / 2;
        for (let h = 0; h < brick.hits; h++) {
          this.ctx.beginPath();
          this.ctx.arc(startX + h * 8, dotY, dotRadius, 0, Math.PI * 2);
          this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          this.ctx.fill();
        }
      }

      // Strain label for top row
      if (brick.maxHits === 3 && brick.y <= this.brickOffsetTop + 2) {
        this.ctx.fillStyle = 'rgba(255,255,255,0.15)';
        this.ctx.font = '7px "Press Start 2P", monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('BONG', brick.x + brick.width / 2, brick.y + brick.height / 2 + 3);
      } else if (brick.maxHits === 2 && brick.y <= this.brickOffsetTop + 2 * (brick.height + this.brickPadding) + 2) {
        this.ctx.fillStyle = 'rgba(255,255,255,0.15)';
        this.ctx.font = '7px "Press Start 2P", monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('BLUNT', brick.x + brick.width / 2, brick.y + brick.height / 2 + 3);
      } else if (brick.maxHits === 1 && brick.y >= this.brickOffsetTop + 4 * (brick.height + this.brickPadding) - 2) {
        this.ctx.fillStyle = 'rgba(255,255,255,0.15)';
        this.ctx.font = '7px "Press Start 2P", monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('DOOBIE', brick.x + brick.width / 2, brick.y + brick.height / 2 + 3);
      }
    }
  }

  private renderPaddle() {
    const px = this.paddleX;
    const py = this.paddleY;
    const pw = this.paddleWidth;
    const ph = this.paddleHeight;

    // Pipe body - brown wood color
    this.ctx.fillStyle = '#8B5E3C';
    this.ctx.fillRect(px, py, pw, ph);

    // Pipe bowl (left side bump)
    this.ctx.fillStyle = '#6B3A1F';
    this.ctx.fillRect(px, py - 6, 14, 6);
    this.ctx.fillStyle = '#8B5E3C';
    this.ctx.fillRect(px + 2, py - 5, 10, 5);

    // Pipe mouthpiece (right side, slightly tapered)
    this.ctx.fillStyle = '#6B3A1F';
    this.ctx.fillRect(px + pw - 8, py + 2, 8, ph - 4);

    // Highlight
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    this.ctx.fillRect(px + 14, py, pw - 22, 3);

    // Bowl glow when wide power-up active
    if (this.widePaddleTimer > 0) {
      this.ctx.fillStyle = 'rgba(0, 255, 136, 0.3)';
      this.ctx.fillRect(px, py - 6, 14, 6);
    }
  }

  private renderBalls() {
    for (const ball of this.balls) {
      const x = ball.pos.x;
      const y = ball.pos.y;
      const r = ball.radius;

      if (ball.fireball) {
        // Fireball glow
        const glowSize = r * 3 + Math.sin(this.glowPhase * 8) * 3;
        const gradient = this.ctx.createRadialGradient(x, y, r * 0.5, x, y, glowSize);
        gradient.addColorStop(0, 'rgba(255, 60, 0, 0.6)');
        gradient.addColorStop(0.5, 'rgba(255, 140, 0, 0.2)');
        gradient.addColorStop(1, 'rgba(255, 60, 0, 0)');
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(x, y, glowSize, 0, Math.PI * 2);
        this.ctx.fill();

        // Core
        this.ctx.fillStyle = '#FF4500';
        this.ctx.beginPath();
        this.ctx.arc(x, y, r + 2, 0, Math.PI * 2);
        this.ctx.fill();

        // Bright center
        this.ctx.fillStyle = '#FFD700';
        this.ctx.beginPath();
        this.ctx.arc(x, y, r * 0.5, 0, Math.PI * 2);
        this.ctx.fill();
      } else {
        // Normal hash ball with glow
        const glowIntensity = 0.3 + Math.sin(this.glowPhase * 4) * 0.1;
        const gradient = this.ctx.createRadialGradient(x, y, r * 0.3, x, y, r * 2.5);
        gradient.addColorStop(0, `rgba(180, 120, 50, ${glowIntensity})`);
        gradient.addColorStop(1, 'rgba(180, 120, 50, 0)');
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(x, y, r * 2.5, 0, Math.PI * 2);
        this.ctx.fill();

        // Ball body - hash brown with texture
        this.ctx.fillStyle = '#C8923A';
        this.ctx.beginPath();
        this.ctx.arc(x, y, r, 0, Math.PI * 2);
        this.ctx.fill();

        // Highlight
        this.ctx.fillStyle = 'rgba(255, 220, 150, 0.6)';
        this.ctx.beginPath();
        this.ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.4, 0, Math.PI * 2);
        this.ctx.fill();

        // Edge darkening
        this.ctx.strokeStyle = 'rgba(100, 60, 20, 0.5)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(x, y, r, 0, Math.PI * 2);
        this.ctx.stroke();
      }
    }
  }

  private renderPowerUps() {
    for (const pu of this.powerUps) {
      // Glow effect
      this.ctx.fillStyle = pu.color + '44';
      this.ctx.fillRect(pu.x - 2, pu.y - 2, pu.width + 4, pu.height + 4);

      // Main body
      this.ctx.fillStyle = pu.color;
      this.ctx.fillRect(pu.x, pu.y, pu.width, pu.height);

      // Label
      this.ctx.fillStyle = '#000';
      this.ctx.font = '10px "Press Start 2P", monospace';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(pu.label, pu.x + pu.width / 2, pu.y + pu.height / 2);

      // Border
      this.ctx.strokeStyle = '#FFF';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(pu.x, pu.y, pu.width, pu.height);
    }
  }

  private renderParticles() {
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      this.ctx.fillStyle = `rgba(${p.color[0]}, ${p.color[1]}, ${p.color[2]}, ${alpha})`;
      this.ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
  }

  private renderHUD() {
    // Score
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = '16px "Press Start 2P", monospace';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';
    this.ctx.fillText(`SCORE: ${this.score}`, 12, 12);

    // Level
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`LVL ${this.level}`, this.canvas.width / 2, 12);

    // Combo
    if (this.combo >= 3) {
      this.ctx.fillStyle = '#FFD700';
      this.ctx.textAlign = 'right';
      this.ctx.fillText(`${this.combo}x COMBO`, this.canvas.width - 12, 12);
    }

    // Lives (balls remaining indicator)
    this.ctx.fillStyle = '#C8923A';
    this.ctx.textAlign = 'right';
    this.ctx.font = '10px "Press Start 2P", monospace';
    for (let i = 0; i < this.balls.length; i++) {
      this.ctx.beginPath();
      this.ctx.arc(this.canvas.width - 12 - i * 16, 36, 5, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // Launch prompt
    if (!this.launched) {
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      this.ctx.font = '12px "Press Start 2P", monospace';
      this.ctx.textAlign = 'center';
      const blink = Math.sin(Date.now() * 0.004) > 0;
      if (blink) {
        this.ctx.fillText('PRESS SPACE OR UP TO LAUNCH', this.canvas.width / 2, this.canvas.height - 80);
      }
    }
  }

  private renderOverlay(title: string, ...lines: string[]) {
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = '36px "Press Start 2P", monospace';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(title, this.canvas.width / 2, this.canvas.height / 2 - 40);

    this.ctx.font = '14px "Press Start 2P", monospace';
    lines.forEach((line, i) => {
      this.ctx.fillStyle = i === 0 ? '#FFD700' : '#AAAAAA';
      this.ctx.fillText(line, this.canvas.width / 2, this.canvas.height / 2 + 20 + i * 28);
    });
  }

  public restart() {
    this.keysPressed.clear();
    this.initializeGame();
    this.start();
  }
}
