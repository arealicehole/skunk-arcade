import { GameEngine } from './GameEngine';

type Position = { x: number; y: number };
type Velocity = { x: number; y: number };

interface Brick {
  x: number;
  y: number;
  width: number;
  height: number;
  hits: number;
  maxHits: number;
  points: number;
  color: string;
  hitColor: string;
  destroyed: boolean;
  tier: 'bong' | 'blunt' | 'doobie';
}

interface Ball {
  pos: Position;
  vel: Velocity;
  radius: number;
  fireball: boolean;
  fireballTimer: number;
  trail: Position[];
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
  leafAngle: number;
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
  isSmoke: boolean;
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

export class HashBashGame extends GameEngine {
  // Paddle (dab rig)
  private paddleWidth = 90;
  private paddleHeight = 18;
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
  private brickOffsetTop = 55;
  private brickOffsetLeft = 30;

  // Power-ups
  private powerUps: PowerUp[] = [];
  private powerUpSpeed = 2;
  private powerUpChance = 0.15;
  private powerUpWidth = 24;
  private powerUpHeight = 24;

  // Particles
  private particles: Particle[] = [];

  // Smoke background
  private smokeWisps: SmokeWisp[] = [];

  // Scoring
  private score = 0;
  private combo = 0;
  private comboTimer = 0;
  private level = 1;

  // State
  private launched = false;
  private keysPressed: Set<string> = new Set();
  private time = 0;

  constructor(canvas: HTMLCanvasElement) {
    super(canvas);
    this.initSmoke();
    this.initializeGame();
  }

  private initSmoke() {
    this.smokeWisps = [];
    for (let i = 0; i < 15; i++) {
      this.smokeWisps.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        size: Math.random() * 60 + 30,
        speed: Math.random() * 0.3 + 0.1,
        alpha: Math.random() * 0.06 + 0.02,
        drift: Math.random() * 0.5 - 0.25,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  private initializeGame() {
    this.paddleY = this.canvas.height - 40;
    this.paddleX = (this.canvas.width - this.paddleWidth) / 2;
    this.paddleWidth = this.basePaddleWidth;
    this.widePaddleTimer = 0;

    this.balls = [this.createBall()];
    this.launched = false;

    this.generateBricks();

    this.powerUps = [];
    this.particles = [];

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
      trail: [],
    };
  }

  private generateBricks() {
    this.bricks = [];
    const totalPadding = this.brickOffsetLeft * 2 + this.brickPadding * (this.brickCols - 1);
    const brickWidth = (this.canvas.width - totalPadding) / this.brickCols;
    const brickHeight = 22;

    const tierDef = (row: number): { maxHits: number; points: number; color: string; hitColor: string; tier: Brick['tier'] } => {
      if (row < 2) return { maxHits: 3, points: 30, color: '#8B0000', hitColor: '#CC3333', tier: 'bong' };
      if (row < 4) return { maxHits: 2, points: 20, color: '#1B5E20', hitColor: '#4CAF50', tier: 'blunt' };
      return { maxHits: 1, points: 10, color: '#B8860B', hitColor: '#FFD700', tier: 'doobie' };
    };

    for (let row = 0; row < this.brickRows; row++) {
      const t = tierDef(row);
      for (let col = 0; col < this.brickCols; col++) {
        this.bricks.push({
          x: this.brickOffsetLeft + col * (brickWidth + this.brickPadding),
          y: this.brickOffsetTop + row * (brickHeight + this.brickPadding),
          width: brickWidth,
          height: brickHeight,
          hits: t.maxHits,
          maxHits: t.maxHits,
          points: t.points,
          color: t.color,
          hitColor: t.hitColor,
          destroyed: false,
          tier: t.tier,
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
      if (event.key === 'Enter') this.restart();
      return;
    }

    if (!this.launched && (event.key === ' ' || event.key === 'ArrowUp')) {
      this.launchBall();
    }

    if (event.key === 'p' || event.key === 'P') {
      if (this.gameState === 'running') this.pause();
      else if (this.gameState === 'paused') this.resume();
    }
  }

  private handleKeyUp(event: KeyboardEvent) {
    this.keysPressed.delete(event.key);
  }

  private launchBall() {
    if (this.launched) return;
    this.launched = true;
    const speed = this.baseBallSpeed + (this.level - 1) * 0.3;
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.6;
    this.balls[0].vel = { x: speed * Math.cos(angle), y: speed * Math.sin(angle) };
  }

  protected update(deltaTime: number) {
    if (this.gameState !== 'running') return;

    this.time += deltaTime;
    this.glowPhase += deltaTime * 0.005;

    // Combo decay
    this.comboTimer -= deltaTime;
    if (this.comboTimer <= 0) this.combo = 0;

    // Wide paddle decay
    if (this.widePaddleTimer > 0) {
      this.widePaddleTimer -= deltaTime;
      if (this.widePaddleTimer <= 0) this.paddleWidth = this.basePaddleWidth;
    }

    this.updateSmoke();
    this.updatePaddle();

    if (!this.launched) {
      this.balls[0].pos.x = this.paddleX + this.paddleWidth / 2;
      this.balls[0].pos.y = this.paddleY - this.ballRadius - 2;
    } else {
      this.updateBalls();
    }

    this.updatePowerUps();
    this.updateParticles(deltaTime);

    if (this.bricks.every(b => b.destroyed)) {
      this.level++;
      this.generateBricks();
      this.launched = false;
      this.balls = [this.createBall()];
      this.powerUps = [];
    }
  }

  private glowPhase = 0;

  private updateSmoke() {
    for (const s of this.smokeWisps) {
      s.y -= s.speed;
      s.x += Math.sin(this.time * 0.001 + s.phase) * s.drift;
      if (s.y + s.size < 0) {
        s.y = this.canvas.height + s.size;
        s.x = Math.random() * this.canvas.width;
      }
    }
  }

  private updatePaddle() {
    if (this.keysPressed.has('ArrowLeft') || this.keysPressed.has('a'))
      this.paddleX = Math.max(0, this.paddleX - this.paddleSpeed);
    if (this.keysPressed.has('ArrowRight') || this.keysPressed.has('d'))
      this.paddleX = Math.min(this.canvas.width - this.paddleWidth, this.paddleX + this.paddleSpeed);
  }

  private updateBalls() {
    const deadBalls: number[] = [];

    for (let i = this.balls.length - 1; i >= 0; i--) {
      const ball = this.balls[i];

      if (ball.fireball) {
        ball.fireballTimer -= 16;
        if (ball.fireballTimer <= 0) ball.fireball = false;
      }

      // Trail
      ball.trail.unshift({ x: ball.pos.x, y: ball.pos.y });
      if (ball.trail.length > 8) ball.trail.pop();

      ball.pos.x += ball.vel.x;
      ball.pos.y += ball.vel.y;

      // Walls
      if (ball.pos.x - ball.radius <= 0) { ball.pos.x = ball.radius; ball.vel.x = Math.abs(ball.vel.x); }
      if (ball.pos.x + ball.radius >= this.canvas.width) { ball.pos.x = this.canvas.width - ball.radius; ball.vel.x = -Math.abs(ball.vel.x); }
      if (ball.pos.y - ball.radius <= 0) { ball.pos.y = ball.radius; ball.vel.y = Math.abs(ball.vel.y); }

      // Bottom
      if (ball.pos.y + ball.radius > this.canvas.height) { deadBalls.push(i); continue; }

      // Paddle
      if (
        ball.vel.y > 0 &&
        ball.pos.y + ball.radius >= this.paddleY &&
        ball.pos.y + ball.radius <= this.paddleY + this.paddleHeight + 4 &&
        ball.pos.x >= this.paddleX && ball.pos.x <= this.paddleX + this.paddleWidth
      ) {
        const hitPos = (ball.pos.x - this.paddleX) / this.paddleWidth;
        const angle = (hitPos - 0.5) * Math.PI * 0.7;
        const speed = Math.sqrt(ball.vel.x ** 2 + ball.vel.y ** 2);
        ball.vel.x = speed * Math.sin(angle);
        ball.vel.y = -speed * Math.cos(angle);
        ball.pos.y = this.paddleY - ball.radius;
        this.combo = 0;
        // Smoke puff on paddle hit
        this.spawnSmokePuff(ball.pos.x, this.paddleY);
      }

      // Bricks
      for (const brick of this.bricks) {
        if (brick.destroyed) continue;
        if (this.ballBrickCollision(ball, brick)) {
          if (!ball.fireball) this.reflectBall(ball, brick);
          brick.hits--;
          this.combo++;
          this.comboTimer = 2000;
          const comboMultiplier = 1 + Math.floor(this.combo / 3) * 0.5;
          this.score += Math.round(brick.points * comboMultiplier);
          this.spawnBrickParticles(brick);
          if (brick.hits <= 0) {
            brick.destroyed = true;
            this.spawnSmokePuff(brick.x + brick.width / 2, brick.y + brick.height / 2);
            if (Math.random() < this.powerUpChance)
              this.spawnPowerUp(brick.x + brick.width / 2, brick.y + brick.height / 2);
          }
          if (!ball.fireball) break;
        }
      }
    }

    for (let i = deadBalls.length - 1; i >= 0; i--) this.balls.splice(deadBalls[i], 1);
    if (this.balls.length === 0) this.gameState = 'gameover';
  }

  private ballBrickCollision(ball: Ball, brick: Brick): boolean {
    const cx = Math.max(brick.x, Math.min(ball.pos.x, brick.x + brick.width));
    const cy = Math.max(brick.y, Math.min(ball.pos.y, brick.y + brick.height));
    const dx = ball.pos.x - cx;
    const dy = ball.pos.y - cy;
    return dx * dx + dy * dy <= ball.radius * ball.radius;
  }

  private reflectBall(ball: Ball, brick: Brick) {
    const cx = brick.x + brick.width / 2;
    const cy = brick.y + brick.height / 2;
    if (Math.abs((ball.pos.x - cx) / brick.width) > Math.abs((ball.pos.y - cy) / brick.height))
      ball.vel.x = ball.pos.x > cx ? Math.abs(ball.vel.x) : -Math.abs(ball.vel.x);
    else
      ball.vel.y = ball.pos.y > cy ? Math.abs(ball.vel.y) : -Math.abs(ball.vel.y);
  }

  private spawnBrickParticles(brick: Brick) {
    const palettes: Record<string, number[][]> = {
      bong: [[200, 30, 30], [255, 80, 80], [139, 0, 0], [100, 255, 100]],
      blunt: [[30, 120, 50], [80, 200, 80], [20, 80, 30], [255, 160, 40]],
      doobie: [[200, 160, 30], [255, 215, 0], [180, 130, 10], [255, 255, 240]],
    };
    const colors = palettes[brick.tier] || palettes.doobie;
    for (let i = 0; i < 10; i++) {
      this.particles.push({
        x: brick.x + Math.random() * brick.width,
        y: brick.y + Math.random() * brick.height,
        vx: (Math.random() - 0.5) * 5,
        vy: (Math.random() - 0.5) * 5 - 1,
        life: 1,
        maxLife: 1,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 5 + 2,
        isSmoke: Math.random() < 0.3,
      });
    }
  }

  private spawnSmokePuff(x: number, y: number) {
    for (let i = 0; i < 5; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 20,
        y,
        vx: (Math.random() - 0.5) * 1.5,
        vy: -Math.random() * 2 - 0.5,
        life: 1,
        maxLife: 1,
        color: [200, 200, 200],
        size: Math.random() * 12 + 6,
        isSmoke: true,
      });
    }
  }

  private spawnPowerUp(x: number, y: number) {
    const types: { type: PowerUp['type']; color: string; label: string }[] = [
      { type: 'wide', color: '#00FF88', label: '🥦' },
      { type: 'multi', color: '#FF8800', label: '🔥' },
      { type: 'fire', color: '#FF2222', label: '💨' },
    ];
    const chosen = types[Math.floor(Math.random() * types.length)];
    this.powerUps.push({
      x: x - this.powerUpWidth / 2,
      y: y - this.powerUpHeight / 2,
      width: this.powerUpWidth,
      height: this.powerUpHeight,
      type: chosen.type,
      vy: this.powerUpSpeed,
      color: chosen.color,
      label: chosen.label,
      leafAngle: Math.random() * Math.PI * 2,
    });
  }

  private updatePowerUps() {
    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const pu = this.powerUps[i];
      pu.y += pu.vy;
      pu.leafAngle += 0.02;

      if (pu.y > this.canvas.height) { this.powerUps.splice(i, 1); continue; }

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
          const ref = this.balls[0];
          for (let i = 0; i < 2; i++) {
            const angle = Math.atan2(ref.vel.y, ref.vel.x) + (i === 0 ? 0.5 : -0.5);
            const speed = Math.sqrt(ref.vel.x ** 2 + ref.vel.y ** 2);
            this.balls.push({
              pos: { x: ref.pos.x, y: ref.pos.y },
              vel: { x: speed * Math.cos(angle), y: speed * Math.sin(angle) },
              radius: this.ballRadius,
              fireball: false, fireballTimer: 0, trail: [],
            });
          }
        }
        break;
      case 'fire':
        for (const ball of this.balls) { ball.fireball = true; ball.fireballTimer = 6000; }
        break;
    }
    this.score += 50;
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      if (p.isSmoke) {
        p.vy -= 0.02;
        p.vx *= 0.99;
        p.size += 0.15;
        p.life -= dt * 0.0012;
      } else {
        p.vy += 0.1;
        p.life -= dt * 0.002;
      }
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  // ─── RENDER ──────────────────────────────────────────────────────

  protected render() {
    this.renderBackground();
    this.renderSmokeWisps();
    this.renderBricks();
    this.renderPowerUps();
    this.renderPaddle();
    this.renderBalls();
    this.renderParticles();
    this.renderHUD();

    if (this.gameState === 'paused') this.renderOverlay('PAUSED', 'PRESS P TO RESUME');
    if (this.gameState === 'gameover') this.renderOverlay('GAME OVER', `FINAL SCORE: ${this.score}`, 'PRESS ENTER TO RESTART');
  }

  private renderBackground() {
    // Deep purple-green gradient
    const grad = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    grad.addColorStop(0, '#0a0612');
    grad.addColorStop(0.4, '#0d1117');
    grad.addColorStop(1, '#0a1a0a');
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Subtle grid lines (arcade CRT feel)
    this.ctx.strokeStyle = 'rgba(0, 255, 100, 0.03)';
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
      grad.addColorStop(0.5, `rgba(100, 160, 100, ${s.alpha * 0.5})`);
      grad.addColorStop(1, 'rgba(80, 120, 80, 0)');
      this.ctx.fillStyle = grad;
      this.ctx.beginPath();
      this.ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  private renderBricks() {
    for (const brick of this.bricks) {
      if (brick.destroyed) continue;
      const isDamaged = brick.hits < brick.maxHits;
      const color = isDamaged ? brick.hitColor : brick.color;
      const bx = brick.x;
      const by = brick.y;
      const bw = brick.width;
      const bh = brick.height;

      if (brick.tier === 'bong') {
        this.renderBongBrick(bx, by, bw, bh, color, brick.hits, brick.maxHits);
      } else if (brick.tier === 'blunt') {
        this.renderBluntBrick(bx, by, bw, bh, color, brick.hits);
      } else {
        this.renderDoobieBrick(bx, by, bw, bh, color, brick.hits);
      }
    }
  }

  private renderBongBrick(x: number, y: number, w: number, h: number, color: string, hits: number, maxHits: number) {
    // Glass body
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.roundRect(x, y, w, h, [3, 3, 0, 0]);
    this.ctx.fill();

    // Glass shine
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    this.ctx.fillRect(x + 2, y + 1, w * 0.3, h - 2);

    // Green water level inside
    const waterAlpha = 0.25 + (hits / maxHits) * 0.35;
    this.ctx.fillStyle = `rgba(0, 255, 80, ${waterAlpha})`;
    const waterH = h * 0.5 * (hits / maxHits);
    this.ctx.fillRect(x + 4, y + h - waterH - 2, w - 8, waterH);

    // Downstem (vertical line, left side)
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(x + w * 0.25, y + 2);
    this.ctx.lineTo(x + w * 0.25, y + h - 2);
    this.ctx.stroke();

    // Bowl on top (small circle)
    this.ctx.fillStyle = '#AA6633';
    this.ctx.beginPath();
    this.ctx.arc(x + w * 0.25, y - 1, 3, 0, Math.PI * 2);
    this.ctx.fill();

    // Hit dots
    this.renderHitDots(x, y, w, h, hits, '#FF4444');
  }

  private renderBluntBrick(x: number, y: number, w: number, h: number, color: string, hits: number) {
    // Wrapper body (rounded)
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.roundRect(x, y + 2, w, h - 4, 6);
    this.ctx.fill();

    // Wrapper lines (texture)
    this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
    this.ctx.lineWidth = 1;
    for (let lx = x + 8; lx < x + w - 4; lx += 10) {
      this.ctx.beginPath();
      this.ctx.moveTo(lx, y + 3);
      this.ctx.lineTo(lx, y + h - 3);
      this.ctx.stroke();
    }

    // Ember tip (right side, glowing)
    const emberGlow = 0.5 + Math.sin(this.time * 0.005 + x) * 0.3;
    this.ctx.fillStyle = `rgba(255, ${Math.floor(80 + emberGlow * 80)}, 0, ${0.6 + emberGlow * 0.4})`;
    this.ctx.beginPath();
    this.ctx.arc(x + w - 4, y + h / 2, 4, 0, Math.PI * 2);
    this.ctx.fill();

    // Ember glow
    const eg = this.ctx.createRadialGradient(x + w - 4, y + h / 2, 1, x + w - 4, y + h / 2, 10);
    eg.addColorStop(0, `rgba(255, 100, 0, ${emberGlow * 0.4})`);
    eg.addColorStop(1, 'rgba(255, 50, 0, 0)');
    this.ctx.fillStyle = eg;
    this.ctx.beginPath();
    this.ctx.arc(x + w - 4, y + h / 2, 10, 0, Math.PI * 2);
    this.ctx.fill();

    // Filter end (left side, white)
    this.ctx.fillStyle = 'rgba(255, 255, 240, 0.7)';
    this.ctx.fillRect(x, y + 4, 5, h - 8);

    this.renderHitDots(x, y, w, h, hits, '#88FF88');
  }

  private renderDoobieBrick(x: number, y: number, w: number, h: number, color: string, hits: number) {
    // Paper body
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.roundRect(x, y + 4, w, h - 8, 4);
    this.ctx.fill();

    // Paper texture (thin lines)
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    this.ctx.lineWidth = 1;
    for (let lx = x + 6; lx < x + w - 4; lx += 8) {
      this.ctx.beginPath();
      this.ctx.moveTo(lx, y + 5);
      this.ctx.lineTo(lx, y + h - 5);
      this.ctx.stroke();
    }

    // Filter (left, white strip)
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    this.ctx.fillRect(x + 1, y + 5, 6, h - 10);

    // Ember tip (right)
    const flicker = 0.6 + Math.sin(this.time * 0.008 + x * 0.1) * 0.3;
    this.ctx.fillStyle = `rgba(255, 120, 20, ${flicker})`;
    this.ctx.beginPath();
    this.ctx.arc(x + w - 3, y + h / 2, 3, 0, Math.PI * 2);
    this.ctx.fill();

    this.renderHitDots(x, y, w, h, hits, '#FFD700');
  }

  private renderHitDots(x: number, y: number, w: number, h: number, hits: number, color: string) {
    if (hits <= 1) return;
    for (let i = 0; i < hits; i++) {
      this.ctx.fillStyle = color;
      this.ctx.globalAlpha = 0.7;
      this.ctx.beginPath();
      this.ctx.arc(x + w / 2 + (i - (hits - 1) / 2) * 8, y + h / 2, 2.5, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.globalAlpha = 1;
    }
  }

  private renderPaddle() {
    const px = this.paddleX;
    const py = this.paddleY;
    const pw = this.paddleWidth;
    const ph = this.paddleHeight;

    // ── DAB RIG ──
    // Base platform
    this.ctx.fillStyle = '#2a2a2a';
    this.ctx.fillRect(px - 4, py + ph - 2, pw + 8, 6);
    this.ctx.fillStyle = '#3a3a3a';
    this.ctx.fillRect(px - 2, py + ph, pw + 4, 4);

    // Glass chamber (main body)
    this.ctx.fillStyle = 'rgba(160, 220, 255, 0.15)';
    this.ctx.beginPath();
    this.ctx.roundRect(px + 10, py - 4, pw - 20, ph + 2, 4);
    this.ctx.fill();
    this.ctx.strokeStyle = 'rgba(160, 220, 255, 0.3)';
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    this.ctx.roundRect(px + 10, py - 4, pw - 20, ph + 2, 4);
    this.ctx.stroke();

    // Glass shine
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    this.ctx.fillRect(px + 12, py - 3, pw * 0.25, ph - 2);

    // Green water inside
    const waterLevel = this.widePaddleTimer > 0 ? 0.9 : 0.5;
    this.ctx.fillStyle = `rgba(0, 255, 100, ${0.15 + waterLevel * 0.2})`;
    const wh = (ph - 6) * waterLevel;
    this.ctx.fillRect(px + 12, py + ph - 4 - wh, pw - 24, wh);

    // Nail/banger on top (center)
    const nailX = px + pw / 2;
    this.ctx.fillStyle = '#888';
    this.ctx.fillRect(nailX - 5, py - 10, 10, 6);
    this.ctx.fillStyle = '#666';
    this.ctx.fillRect(nailX - 3, py - 14, 6, 4);

    // Dab on nail (tiny amber blob)
    this.ctx.fillStyle = `rgba(255, 180, 50, ${0.5 + Math.sin(this.time * 0.006) * 0.3})`;
    this.ctx.beginPath();
    this.ctx.arc(nailX, py - 12, 3, 0, Math.PI * 2);
    this.ctx.fill();

    // Stem (left side, down from chamber)
    this.ctx.strokeStyle = 'rgba(160, 220, 255, 0.25)';
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.moveTo(px + 6, py + ph / 2);
    this.ctx.lineTo(px - 2, py + ph + 4);
    this.ctx.lineTo(px + 8, py + ph + 8);
    this.ctx.stroke();

    // Mouthpiece (right side)
    this.ctx.fillStyle = '#555';
    this.ctx.beginPath();
    this.ctx.roundRect(px + pw - 6, py + 2, 8, ph - 4, 2);
    this.ctx.fill();
    this.ctx.fillStyle = '#666';
    this.ctx.fillRect(px + pw - 4, py + 4, 4, ph - 8);

    // Wide power-up glow
    if (this.widePaddleTimer > 0) {
      this.ctx.fillStyle = 'rgba(0, 255, 136, 0.15)';
      this.ctx.beginPath();
      this.ctx.roundRect(px + 8, py - 6, pw - 16, ph + 6, 6);
      this.ctx.fill();
    }
  }

  private renderBalls() {
    for (const ball of this.balls) {
      const x = ball.pos.x;
      const y = ball.pos.y;
      const r = ball.radius;

      // Trail
      for (let t = 0; t < ball.trail.length; t++) {
        const tp = ball.trail[t];
        const alpha = (1 - t / ball.trail.length) * 0.3;
        if (ball.fireball) {
          this.ctx.fillStyle = `rgba(255, 100, 0, ${alpha})`;
        } else {
          this.ctx.fillStyle = `rgba(255, 180, 50, ${alpha})`;
        }
        const trailSize = r * (1 - t / ball.trail.length) * 0.8;
        this.ctx.beginPath();
        this.ctx.arc(tp.x, tp.y, trailSize, 0, Math.PI * 2);
        this.ctx.fill();
      }

      if (ball.fireball) {
        // Inferno dab — big glow
        const glowSize = r * 4 + Math.sin(this.time * 0.008) * 4;
        const g = this.ctx.createRadialGradient(x, y, r * 0.3, x, y, glowSize);
        g.addColorStop(0, 'rgba(255, 200, 0, 0.7)');
        g.addColorStop(0.3, 'rgba(255, 80, 0, 0.4)');
        g.addColorStop(0.7, 'rgba(255, 30, 0, 0.1)');
        g.addColorStop(1, 'rgba(255, 0, 0, 0)');
        this.ctx.fillStyle = g;
        this.ctx.beginPath();
        this.ctx.arc(x, y, glowSize, 0, Math.PI * 2);
        this.ctx.fill();

        // Core
        this.ctx.fillStyle = '#FF6600';
        this.ctx.beginPath();
        this.ctx.arc(x, y, r + 3, 0, Math.PI * 2);
        this.ctx.fill();

        // White-hot center
        this.ctx.fillStyle = '#FFEECC';
        this.ctx.beginPath();
        this.ctx.arc(x, y, r * 0.4, 0, Math.PI * 2);
        this.ctx.fill();
      } else {
        // Amber dab — pulsing warm glow
        const pulse = 0.3 + Math.sin(this.time * 0.004) * 0.15;
        const g = this.ctx.createRadialGradient(x, y, r * 0.3, x, y, r * 3);
        g.addColorStop(0, `rgba(255, 200, 80, ${pulse})`);
        g.addColorStop(1, 'rgba(255, 150, 30, 0)');
        this.ctx.fillStyle = g;
        this.ctx.beginPath();
        this.ctx.arc(x, y, r * 3, 0, Math.PI * 2);
        this.ctx.fill();

        // Amber blob body (slightly irregular shape)
        this.ctx.fillStyle = '#E8A020';
        this.ctx.beginPath();
        // Wobbly circle for organic feel
        const wobble = Math.sin(this.time * 0.006) * 1.5;
        this.ctx.ellipse(x, y, r + wobble, r - wobble * 0.5, this.time * 0.002, 0, Math.PI * 2);
        this.ctx.fill();

        // Glass-like highlight
        this.ctx.fillStyle = 'rgba(255, 240, 200, 0.7)';
        this.ctx.beginPath();
        this.ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, Math.PI * 2);
        this.ctx.fill();

        // Dark edge
        this.ctx.strokeStyle = 'rgba(180, 100, 0, 0.5)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.ellipse(x, y, r + wobble, r - wobble * 0.5, this.time * 0.002, 0, Math.PI * 2);
        this.ctx.stroke();
      }
    }
  }

  private renderPowerUps() {
    for (const pu of this.powerUps) {
      const cx = pu.x + pu.width / 2;
      const cy = pu.y + pu.height / 2;

      this.ctx.save();
      this.ctx.translate(cx, cy);
      this.ctx.rotate(pu.leafAngle);

      // Draw a cannabis leaf shape
      this.ctx.fillStyle = pu.color;
      this.ctx.globalAlpha = 0.9;

      // Leaf center
      this.ctx.beginPath();
      this.ctx.arc(0, 0, 4, 0, Math.PI * 2);
      this.ctx.fill();

      // 7 leaflets (classic leaf shape)
      const leafSize = 10;
      for (let i = 0; i < 7; i++) {
        const angle = (i / 7) * Math.PI * 2 - Math.PI / 2;
        const lx = Math.cos(angle) * leafSize;
        const ly = Math.sin(angle) * leafSize;
        this.ctx.beginPath();
        this.ctx.ellipse(lx, ly, 5, 2.5, angle, 0, Math.PI * 2);
        this.ctx.fill();
      }

      this.ctx.globalAlpha = 1;
      this.ctx.restore();

      // Glow ring
      this.ctx.strokeStyle = pu.color;
      this.ctx.globalAlpha = 0.3 + Math.sin(this.time * 0.005 + pu.x) * 0.15;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, 14, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.globalAlpha = 1;

      // Label emoji
      this.ctx.font = '12px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(pu.label, cx, cy);
    }
  }

  private renderParticles() {
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      if (p.isSmoke) {
        const g = this.ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        g.addColorStop(0, `rgba(${p.color[0]}, ${p.color[1]}, ${p.color[2]}, ${alpha * 0.4})`);
        g.addColorStop(1, `rgba(${p.color[0]}, ${p.color[1]}, ${p.color[2]}, 0)`);
        this.ctx.fillStyle = g;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        this.ctx.fill();
      } else {
        this.ctx.fillStyle = `rgba(${p.color[0]}, ${p.color[1]}, ${p.color[2]}, ${alpha})`;
        this.ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }
  }

  private renderHUD() {
    // Score with neon green glow
    this.ctx.shadowColor = '#00FF66';
    this.ctx.shadowBlur = 8;
    this.ctx.fillStyle = '#00FF66';
    this.ctx.font = '16px "Press Start 2P", monospace';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';
    this.ctx.fillText(`${this.score}`, 12, 14);
    this.ctx.shadowBlur = 0;

    // Score label
    this.ctx.fillStyle = 'rgba(0, 255, 100, 0.4)';
    this.ctx.font = '8px "Press Start 2P", monospace';
    this.ctx.fillText('HASH', 12, 8);

    // Level
    this.ctx.shadowColor = '#00FF66';
    this.ctx.shadowBlur = 6;
    this.ctx.fillStyle = '#00FF66';
    this.ctx.font = '12px "Press Start 2P", monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`LVL ${this.level}`, this.canvas.width / 2, 16);
    this.ctx.shadowBlur = 0;

    // Combo
    if (this.combo >= 3) {
      this.ctx.shadowColor = '#FFD700';
      this.ctx.shadowBlur = 10;
      this.ctx.fillStyle = '#FFD700';
      this.ctx.font = '14px "Press Start 2P", monospace';
      this.ctx.textAlign = 'right';
      this.ctx.fillText(`${this.combo}x`, this.canvas.width - 12, 14);
      this.ctx.shadowBlur = 0;
      this.ctx.fillStyle = 'rgba(255, 215, 0, 0.5)';
      this.ctx.font = '8px "Press Start 2P", monospace';
      this.ctx.fillText('COMBO', this.canvas.width - 12, 30);
    }

    // Ball count
    this.ctx.fillStyle = '#E8A020';
    this.ctx.textAlign = 'right';
    this.ctx.font = '10px "Press Start 2P", monospace';
    for (let i = 0; i < this.balls.length; i++) {
      this.ctx.beginPath();
      this.ctx.arc(this.canvas.width - 14 - i * 14, 46, 4, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // Launch prompt
    if (!this.launched) {
      const blink = Math.sin(Date.now() * 0.004) > 0;
      if (blink) {
        this.ctx.shadowColor = '#00FF66';
        this.ctx.shadowBlur = 6;
        this.ctx.fillStyle = 'rgba(0, 255, 100, 0.7)';
        this.ctx.font = '11px "Press Start 2P", monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('SPACE TO RIP', this.canvas.width / 2, this.canvas.height - 75);
        this.ctx.shadowBlur = 0;
      }
    }
  }

  private renderOverlay(title: string, ...lines: string[]) {
    this.ctx.fillStyle = 'rgba(5, 2, 10, 0.82)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Title with neon glow
    this.ctx.shadowColor = '#00FF66';
    this.ctx.shadowBlur = 20;
    this.ctx.fillStyle = '#00FF66';
    this.ctx.font = '32px "Press Start 2P", monospace';
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

  public restart() {
    this.keysPressed.clear();
    this.initializeGame();
    this.start();
  }
}
