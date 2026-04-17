import { GameEngine } from './GameEngine';

// Bud Bomber - A bud-drone shooter game
// Control a tiny bud-harvesting drone, shoot seeds to grow buds, collect for points!

interface Position { x: number; y: number }
interface Velocity { x: number; y: number }

interface Bullet {
  pos: Position;
  vel: Velocity;
  active: boolean;
}

interface Bud {
  pos: Position;
  active: boolean;
  growth: number;
  maxGrowth: number;
}

interface Fire {
  pos: Position;
  radius: number;
  active: boolean;
  damageCooldown: number;
}

interface Particle {
  pos: Position;
  vel: Velocity;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface ScoreData {
  buds: number;
  points: number;
  highScore: number;
}

export class BudBomberGame extends GameEngine {
  // Player (bud-drone)
  private dronePos: Position = { x: 0, y: 0 };
  private droneVel: Velocity = { x: 0, y: 0 };
  private droneSize = 15;
  private droneSpeed = 4;
  private droneAngle = 0;
  private droneSprite!: HTMLImageElement;
  private droneSpriteLoaded = false;

  // Bullets (seeds)
  private bullets: Bullet[] = [];
  private bulletSpeed = 8;
  private bulletCooldown = 150;
  private lastShot = 0;

  // Buds to collect
  private buds: Bud[] = [];
  private budSpawnRate = 2000;
  private lastBudSpawn = 0;

  // Fire hazards (The Burn)
  private fires: Fire[] = [];
  private fireSpawnRate = 3000;
  private lastFireSpawn = 0;
  private fireDamageCooldown = 30;

  // Particles
  private particles: Particle[] = [];

  // Game state
  private score: ScoreData = { buds: 0, points: 0, highScore: 0 };
  private isRunning = false;
  private isGameOver = false;

  // Movement
  private moveKeys: Set<string> = new Set();
  private shootKey = false;
  private lastMoveTime = 0;
  private moveInterval = 100; // ms between direction changes

  constructor(canvas: HTMLCanvasElement) {
    super(canvas);
    this.loadSprites();
    this.resetGame();
  }

  private loadSprites() {
    // Load drone sprite (will use leaf as fallback)
    this.droneSprite = new Image();
    this.droneSprite.src = '/images/leaf.png';
    this.droneSprite.onload = () => {
      this.droneSpriteLoaded = true;
      console.log('Drone sprite loaded');
    };
    this.droneSprite.onerror = () => {
      console.error('Failed to load drone sprite');
    };

    // Load bud sprite
    const budSprite = new Image();
    budSprite.src = '/images/skunk.png'; // Using skunk as bud placeholder
    budSprite.onload = () => {
      console.log('Bud sprite loaded');
    };
  }

  private resetGame() {
    this.dronePos = { x: this.canvas.width / 2, y: this.canvas.height / 2 };
    this.droneVel = { x: 0, y: 0 };
    this.droneAngle = 0;
    this.bullets = [];
    this.buds = [];
    this.fires = [];
    this.particles = [];
    this.score = { buds: 0, points: 0, highScore: 0 };
    this.isRunning = false;
    this.isGameOver = false;
    this.moveKeys.clear();
    this.shootKey = false;
    this.lastMoveTime = 0;
  }

  protected handleKeyDown(event: KeyboardEvent) {
    switch (event.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        this.moveKeys.add('up');
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        this.moveKeys.add('down');
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        this.moveKeys.add('left');
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        this.moveKeys.add('right');
        break;
      case ' ':
        this.shootKey = true;
        if (this.gameState === 'running') {
          this.shoot();
        }
        break;
      case 'Enter':
        this.restart();
        break;
      case 'Escape':
        this.gameState = 'gameover';
        break;
    }
  }

  protected handleKeyUp(event: KeyboardEvent) {
    switch (event.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        this.moveKeys.delete('up');
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        this.moveKeys.delete('down');
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        this.moveKeys.delete('left');
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        this.moveKeys.delete('right');
        break;
      case ' ':
        this.shootKey = false;
        break;
    }
  }

  private shoot() {
    const now = Date.now();
    if (now - this.lastShot < this.bulletCooldown) return;

    this.lastShot = now;

    // Shoot in direction of movement
    let angle = this.droneAngle;
    if (this.moveKeys.has('up')) angle = -Math.PI / 2;
    else if (this.moveKeys.has('down')) angle = Math.PI / 2;
    else if (this.moveKeys.has('left')) angle = Math.PI;
    else if (this.moveKeys.has('right')) angle = 0;
    else angle = 0;

    this.bullets.push({
      pos: { x: this.dronePos.x, y: this.dronePos.y },
      vel: { x: Math.cos(angle) * this.bulletSpeed, y: Math.sin(angle) * this.bulletSpeed },
      active: true,
    });
  }

  protected update(deltaTime: number) {
    if (this.gameState !== 'running' || this.isGameOver) return;

    const now = Date.now();

    // Update drone movement
    this.updateDroneMovement(deltaTime);

    // Update bullets
    this.updateBullets(deltaTime);

    // Update buds
    this.updateBuds(now);

    // Update fires
    this.updateFires(now);

    // Update particles
    this.updateParticles(deltaTime);

    // Spawn elements
    if (now - this.lastBudSpawn > this.budSpawnRate) {
      this.spawnBud();
      this.lastBudSpawn = now;
    }

    if (now - this.lastFireSpawn > this.fireSpawnRate) {
      this.spawnFire();
      this.lastFireSpawn = now;
    }

    // Check game over
    if (this.checkGameOver()) {
      this.isGameOver = true;
      this.gameState = 'gameover';
      return;
    }
  }

  private updateDroneMovement(deltaTime: number) {
    // Smooth movement
    const acceleration = 0.5;
    const friction = 0.92;

    // Calculate target velocity based on keys
    let targetVelX = 0;
    let targetVelY = 0;

    if (this.moveKeys.has('up')) targetVelY = -this.droneSpeed;
    if (this.moveKeys.has('down')) targetVelY = this.droneSpeed;
    if (this.moveKeys.has('left')) targetVelX = -this.droneSpeed;
    if (this.moveKeys.has('right')) targetVelX = this.droneSpeed;

    // Apply acceleration
    this.droneVel.x += (targetVelX - this.droneVel.x) * acceleration * deltaTime;
    this.droneVel.y += (targetVelY - this.droneVel.y) * acceleration * deltaTime;

    // Apply friction
    this.droneVel.x *= friction;
    this.droneVel.y *= friction;

    // Update position
    this.dronePos.x += this.droneVel.x;
    this.dronePos.y += this.droneVel.y;

    // Update angle
    if (this.droneVel.x !== 0 || this.droneVel.y !== 0) {
      this.droneAngle = Math.atan2(this.droneVel.y, this.droneVel.x);
    }

    // Boundary checks
    const maxX = this.canvas.width - this.droneSize;
    const maxY = this.canvas.height - this.droneSize;

    if (this.dronePos.x < 0) this.dronePos.x = 0;
    if (this.dronePos.y < 0) this.dronePos.y = 0;
    if (this.dronePos.x > maxX) this.dronePos.x = maxX;
    if (this.dronePos.y > maxY) this.dronePos.y = maxY;
  }

  private updateBullets(deltaTime: number) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      bullet.pos.x += bullet.vel.x * deltaTime;
      bullet.pos.y += bullet.vel.y * deltaTime;

      // Remove bullets off-screen
      if (
        bullet.pos.x < 0 ||
        bullet.pos.x > this.canvas.width ||
        bullet.pos.y < 0 ||
        bullet.pos.y > this.canvas.height
      ) {
        bullet.active = false;
      }
    }

    this.bullets = this.bullets.filter(b => b.active);
  }

  private updateBuds(now: number) {
    // Use 'now' for timestamp-based operations if needed
    const _now = now; // eslint-disable-line @typescript-eslint/no-unused-vars
    for (let i = this.buds.length - 1; i >= 0; i--) {
      const bud = this.buds[i];

      // Grow the bud
      bud.growth += 0.5;

      // Check if fully grown
      if (bud.growth >= bud.maxGrowth) {
        // Collect the bud
        this.collectBud();
        this.buds.splice(i, 1);
        continue;
      }

      // Check collision with drone
      const dx = this.dronePos.x - bud.pos.x;
      const dy = this.dronePos.y - bud.pos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < this.droneSize + 20) {
        this.collectBud();
        this.buds.splice(i, 1);
      }
    }
  }

  private updateFires(now: number) {
    for (let i = this.fires.length - 1; i >= 0; i--) {
      const fire = this.fires[i];

      // Check damage cooldown
      if (now - fire.damageCooldown > this.fireDamageCooldown) {
        this.takeDamage();
        fire.damageCooldown = now;
      }
    }
  }

  private updateParticles(deltaTime: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];

      particle.pos.x += particle.vel.x * deltaTime;
      particle.pos.y += particle.vel.y * deltaTime;
      particle.life -= deltaTime;
      particle.vel.x *= 0.95;
      particle.vel.y *= 0.95;

      if (particle.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  private spawnBud() {
    const angle = Math.random() * Math.PI * 2;
    const distance = 100 + Math.random() * 150;

    this.buds.push({
      pos: {
        x: this.dronePos.x + Math.cos(angle) * distance,
        y: this.dronePos.y + Math.sin(angle) * distance,
      },
      active: true,
      growth: 0,
      maxGrowth: 3,
    });
  }

  private spawnFire() {
    const angle = Math.random() * Math.PI * 2;
    const distance = 200 + Math.random() * 300;

    this.fires.push({
      pos: {
        x: this.dronePos.x + Math.cos(angle) * distance,
        y: this.dronePos.y + Math.sin(angle) * distance,
      },
      radius: 50 + Math.random() * 50,
      active: true,
      damageCooldown: 0,
    });
  }

  private collectBud() {
    this.score.buds++;
    this.score.points += 10;
    this.createExplosion(this.buds[this.buds.length - 1].pos.x, this.buds[this.buds.length - 1].pos.y);
  }

  private takeDamage() {
    this.score.points = Math.max(0, this.score.points - 50);
    this.createExplosion(this.dronePos.x, this.dronePos.y);

    // Flash screen red
    this.ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private checkGameOver(): boolean {
    // Check collision with fires
    for (const fire of this.fires) {
      const dx = this.dronePos.x - fire.pos.x;
      const dy = this.dronePos.y - fire.pos.y;
      if (Math.sqrt(dx * dx + dy * dy) < fire.radius) {
        return true;
      }
    }

    // Check bullet collisions with buds
    for (const bullet of this.bullets) {
      for (const bud of this.buds) {
        const dx = bullet.pos.x - bud.pos.x;
        const dy = bullet.pos.y - bud.pos.y;
        if (Math.sqrt(dx * dx + dy * dy) < 30) {
          // Bullet destroys bud but doesn't give points
          this.buds.splice(this.buds.indexOf(bud), 1);
          return true; // Game over - you're destroying the plants!
        }
      }
    }

    return false;
  }

  private createExplosion(x: number, y: number) {
    for (let i = 0; i < 10; i++) {
      this.particles.push({
        pos: { x, y },
        vel: {
          x: (Math.random() - 0.5) * 8,
          y: (Math.random() - 0.5) * 8,
        },
        life: 500,
        maxLife: 500,
        color: `hsl(${Math.random() * 60 + 40}, 100%, 50%)`, // Green/yellow hues
        size: 3 + Math.random() * 4,
      });
    }
  }

  protected render() {
    // Background
    this.ctx.fillStyle = '#1a1a1a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw grid
    this.drawGrid();

    // Draw fires
    this.fires.forEach(fire => {
      this.ctx.fillStyle = `rgba(255, 100, 50, ${0.3 + (Math.sin(Date.now() / 200) + 1) / 2})`;
      this.ctx.beginPath();
      this.ctx.arc(fire.pos.x, fire.pos.y, fire.radius, 0, Math.PI * 2);
      this.ctx.fill();

      // Fire particles
      this.ctx.fillStyle = 'rgba(255, 200, 100, 0.5)';
      for (let i = 0; i < 5; i++) {
        this.ctx.beginPath();
        const angle = (i / 5) * Math.PI * 2;
        const radius = fire.radius * 0.7;
        this.ctx.arc(
          fire.pos.x + Math.cos(angle) * radius,
          fire.pos.y + Math.sin(angle) * radius,
          5,
          0,
          Math.PI * 2
        );
        this.ctx.fill();
      }
    });

    // Draw buds
    this.buds.forEach(bud => {
      const size = 15 + bud.growth * 2;
      this.ctx.fillStyle = '#8B4513';
      this.ctx.beginPath();
      this.ctx.arc(bud.pos.x, bud.pos.y, size, 0, Math.PI * 2);
      this.ctx.fill();

      // Bud details
      this.ctx.fillStyle = '#228B22';
      this.ctx.beginPath();
      this.ctx.arc(bud.pos.x, bud.pos.y, size * 0.7, 0, Math.PI * 2);
      this.ctx.fill();
    });

    // Draw bullets
    this.bullets.forEach(bullet => {
      this.ctx.fillStyle = '#FFFF00';
      this.ctx.beginPath();
      this.ctx.arc(bullet.pos.x, bullet.pos.y, 4, 0, Math.PI * 2);
      this.ctx.fill();

      // Bullet glow
      this.ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
      this.ctx.beginPath();
      this.ctx.arc(bullet.pos.x, bullet.pos.y, 8, 0, Math.PI * 2);
      this.ctx.fill();
    });

    // Draw particles
    this.particles.forEach(particle => {
      this.ctx.fillStyle = particle.color;
      this.ctx.beginPath();
      this.ctx.arc(particle.pos.x, particle.pos.y, particle.size, 0, Math.PI * 2);
      this.ctx.fill();
    });

    // Draw drone (bud-drone)
    this.drawDrone();

    // Draw score
    this.drawScore();

    // Game over screen
    if (this.isGameOver) {
      this.drawGameOver();
    }
  }

  private drawGrid() {
    this.ctx.strokeStyle = '#333';
    this.ctx.lineWidth = 1;

    const gridSize = 50;

    for (let x = 0; x < this.canvas.width; x += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
      this.ctx.stroke();
    }

    for (let y = 0; y < this.canvas.height; y += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
      this.ctx.stroke();
    }
  }

  private drawDrone() {
    // Draw drone body
    this.ctx.save();
    this.ctx.translate(this.dronePos.x, this.dronePos.y);
    this.ctx.rotate(this.droneAngle);

    // Drone body
    this.ctx.fillStyle = '#444';
    this.ctx.beginPath();
    this.ctx.ellipse(0, 0, this.droneSize, this.droneSize * 0.6, 0, 0, Math.PI * 2);
    this.ctx.fill();

    // Drone propeller
    this.ctx.fillStyle = '#666';
    this.ctx.fillRect(-this.droneSize - 5, -5, 10, 10);

    // Drone light
    this.ctx.fillStyle = '#0F0';
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 5, 0, Math.PI * 2);
    this.ctx.fill();

    // Light beam
    this.ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
    this.ctx.beginPath();
    this.ctx.moveTo(-10, -5);
    this.ctx.lineTo(this.droneSize * 2, 0);
    this.ctx.lineTo(-10, 5);
    this.ctx.fill();

    this.ctx.restore();

    // Draw drone sprite if loaded
    if (this.droneSpriteLoaded) {
      this.ctx.save();
      this.ctx.translate(this.dronePos.x, this.dronePos.y);
      this.ctx.rotate(this.droneAngle);

      // Scale sprite to fit
      const scale = 1.5;
      const spriteX = -this.droneSize * scale / 2;
      const spriteY = -this.droneSize * scale / 2;
      const spriteWidth = this.droneSize * scale;
      const spriteHeight = this.droneSize * scale;

      this.ctx.drawImage(
        this.droneSprite,
        spriteX,
        spriteY,
        spriteWidth,
        spriteHeight
      );

      this.ctx.restore();
    }
  }

  private drawScore() {
    this.ctx.fillStyle = '#0F0';
    this.ctx.font = '20px "Press Start 2P", monospace';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';

    this.ctx.fillText(`SCORE: ${this.score.points}`, 20, 20);
    this.ctx.fillText(`BUDS: ${this.score.buds}`, 20, 45);
    this.ctx.fillText(`HIGH: ${this.score.highScore}`, 20, 70);
  }

  private drawGameOver() {
    // Semi-transparent overlay
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Game over text
    this.ctx.fillStyle = '#FF0000';
    this.ctx.font = '40px "Press Start 2P", monospace';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2 - 40);

    // Final score
    this.ctx.fillStyle = '#FFF';
    this.ctx.font = '20px "Press Start 2P", monospace';
    this.ctx.fillText(
      `FINAL SCORE: ${this.score.points}`,
      this.canvas.width / 2,
      this.canvas.height / 2 + 20
    );

    this.ctx.fillText(
      `BUDS COLLECTED: ${this.score.buds}`,
      this.canvas.width / 2,
      this.canvas.height / 2 + 50
    );

    // Restart instruction
    this.ctx.fillStyle = '#0F0';
    this.ctx.font = '16px "Press Start 2P", monospace';
    this.ctx.fillText('PRESS ENTER TO RESTART', this.canvas.width / 2, this.canvas.height / 2 + 90);
  }

  public restart() {
    this.resetGame();
    this.isGameOver = false;
    this.gameState = 'running';
    this.start();
  }

  public getScore(): ScoreData {
    return this.score;
  }
}
