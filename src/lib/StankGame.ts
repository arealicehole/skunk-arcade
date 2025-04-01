import { GameEngine } from './GameEngine';

type Direction = 'up' | 'down' | 'left' | 'right';
type Position = { x: number; y: number };

interface FoodItem {
  sprite: HTMLImageElement;
  rarity: number;
  points: number;
}

export class StankGame extends GameEngine {
  private gridSize = 20;
  private skunkPos: Position = { x: 0, y: 0 };
  private food: Position = { x: 0, y: 0 };
  private direction: Direction = 'right';
  private nextDirection: Direction = 'right';
  private score = 0;
  private moveInterval = 150; // ms
  private timeSinceLastMove = 0;
  private stinkTrail: Position[] = [];
  private stinkLength = 1; // Initial length of stink trail
  private stinkRadius = 0.8; // Size of each stink circle
  private stinkGrowthRate = 0.05; // How much the radius grows per food eaten
  private skunkSprite!: HTMLImageElement;
  private spriteLoaded = false;
  private foodSprites: FoodItem[] = [];
  private currentFoodSprite: FoodItem | null = null;

  constructor(canvas: HTMLCanvasElement) {
    super(canvas);
    this.loadSprites();
    this.initializeGame();
  }

  private loadSprites() {
    // Load skunk sprite
    this.skunkSprite = new Image();
    this.skunkSprite.onload = () => {
      console.log('Skunk sprite loaded successfully');
      this.spriteLoaded = true;
    };
    this.skunkSprite.onerror = (e) => {
      console.error('Error loading skunk sprite:', e);
    };
    this.skunkSprite.src = '/images/skunk.png';

    // Load food sprites with their rarity and points
    const foodTypes = [
      { name: 'Doobie', rarity: 50, points: 10 },
      { name: 'Blunt', rarity: 50, points: 15 },
      { name: 'Bong', rarity: 40, points: 20 },
      { name: 'Rig', rarity: 40, points: 25 }
    ];

    foodTypes.forEach(food => {
      const sprite = new Image();
      sprite.src = `/images/food/${food.name}_${food.rarity}.png`;
      this.foodSprites.push({
        sprite,
        rarity: food.rarity,
        points: food.points
      });
    });
  }

  private getRandomFoodSprite(): FoodItem {
    // Total up the rarity values
    const totalRarity = this.foodSprites.reduce((sum, food) => sum + food.rarity, 0);
    
    // Generate a random number between 0 and total rarity
    let random = Math.random() * totalRarity;
    
    // Find the food item that corresponds to this random number
    for (const food of this.foodSprites) {
      random -= food.rarity;
      if (random <= 0) {
        return food;
      }
    }
    
    // Fallback to first food item (shouldn't happen due to math above)
    return this.foodSprites[0];
  }

  private initializeGame() {
    // Start with just the skunk head
    const centerY = Math.floor(this.canvas.height / (2 * this.gridSize));
    const centerX = Math.floor(this.canvas.width / (4 * this.gridSize));
    this.skunkPos = { x: centerX, y: centerY };
    this.spawnFood();
    
    // Reset game state
    this.direction = 'right';
    this.nextDirection = 'right';
    this.score = 0;
    this.stinkTrail = [];
    this.stinkLength = 1;
    this.gameState = 'running';
  }

  private spawnFood() {
    const maxX = Math.floor(this.canvas.width / this.gridSize);
    const maxY = Math.floor(this.canvas.height / this.gridSize);
    
    do {
      this.food = {
        x: Math.floor(Math.random() * maxX),
        y: Math.floor(Math.random() * maxY),
      };
    } while (this.skunkPos.x === this.food.x && this.skunkPos.y === this.food.y);

    // Select a random food sprite based on rarity
    this.currentFoodSprite = this.getRandomFoodSprite();
  }

  protected handleKeyDown(event: KeyboardEvent) {
    switch (event.key) {
      case 'ArrowUp':
        if (this.direction !== 'down') this.nextDirection = 'up';
        break;
      case 'ArrowDown':
        if (this.direction !== 'up') this.nextDirection = 'down';
        break;
      case 'ArrowLeft':
        if (this.direction !== 'right') this.nextDirection = 'left';
        break;
      case 'ArrowRight':
        if (this.direction !== 'left') this.nextDirection = 'right';
        break;
      case 'Enter':
        this.restart();
        break;
    }
  }

  protected update(deltaTime: number) {
    if (this.gameState !== 'running') return;

    this.timeSinceLastMove += deltaTime;
    if (this.timeSinceLastMove < this.moveInterval) return;

    this.timeSinceLastMove = 0;
    this.direction = this.nextDirection;

    // Calculate new position
    const newPos = { ...this.skunkPos };
    switch (this.direction) {
      case 'up': newPos.y--; break;
      case 'down': newPos.y++; break;
      case 'left': newPos.x--; break;
      case 'right': newPos.x++; break;
    }

    // Check for collisions
    if (this.checkCollision(newPos)) {
      this.gameState = 'gameover';
      return;
    }

    // Add new position to stink trail
    this.stinkTrail.unshift({ ...this.skunkPos });
    
    // Keep only the required number of trail segments
    while (this.stinkTrail.length > this.stinkLength) {
      this.stinkTrail.pop();
    }

    // Move skunk
    this.skunkPos = newPos;

    // Check if food is eaten
    if (newPos.x === this.food.x && newPos.y === this.food.y) {
      // Add points based on the food type
      this.score += this.currentFoodSprite?.points || 10;
      this.stinkLength++; // Add one more circle to the trail
      this.spawnFood();
    }
  }

  private checkCollision(pos: Position): boolean {
    const maxX = Math.floor(this.canvas.width / this.gridSize);
    const maxY = Math.floor(this.canvas.height / this.gridSize);

    // Wall collision
    if (pos.x < 0 || pos.x >= maxX || pos.y < 0 || pos.y >= maxY) {
      return true;
    }

    // Stink trail collision
    return this.stinkTrail.some(stink => {
      const dx = pos.x - stink.x;
      const dy = pos.y - stink.y;
      return Math.sqrt(dx * dx + dy * dy) < this.stinkRadius;
    });
  }

  protected render() {
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw stink trail circles
    this.stinkTrail.forEach((pos, index) => {
      const alpha = 0.7 * (this.stinkTrail.length - index) / this.stinkTrail.length;
      this.ctx.fillStyle = `rgba(144, 238, 144, ${alpha})`;  // Light green for stink
      
      // Draw a circular cloud
      this.ctx.beginPath();
      const centerX = (pos.x * this.gridSize) + (this.gridSize / 2);
      const centerY = (pos.y * this.gridSize) + (this.gridSize / 2);
      const radius = this.gridSize * this.stinkRadius;
      this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      this.ctx.fill();
    });

    // Draw skunk head with sprite
    const x = this.skunkPos.x * this.gridSize;
    const y = this.skunkPos.y * this.gridSize;
    
    if (this.spriteLoaded) {
      // Save the current context state
      this.ctx.save();
      
      // Translate to the position and rotate based on direction
      this.ctx.translate(x + this.gridSize / 2, y + this.gridSize / 2);
      switch (this.direction) {
        case 'up': this.ctx.rotate(-Math.PI / 2); break;
        case 'down': this.ctx.rotate(Math.PI / 2); break;
        case 'left': this.ctx.rotate(Math.PI); break;
        case 'right': break; // Default direction
      }
      this.ctx.translate(-this.gridSize / 2, -this.gridSize / 2);
      
      // Draw the sprite twice as large as the grid size
      const scale = 2.4; // Make sprite 240% larger (twice as big as 1.2)
      const offset = (this.gridSize * (scale - 1)) / 2;
      try {
        this.ctx.drawImage(
          this.skunkSprite, 
          -offset, 
          -offset, 
          this.gridSize * scale, 
          this.gridSize * scale
        );
      } catch (e) {
        console.error('Error drawing skunk sprite:', e);
        // Fallback to circle if sprite fails
        this.ctx.beginPath();
        this.ctx.arc(
          this.gridSize / 2,
          this.gridSize / 2,
          this.gridSize / 2,
          0,
          Math.PI * 2
        );
        this.ctx.fill();
      }
      
      // Restore the context state
      this.ctx.restore();
    } else {
      // Fallback head rendering if sprite not loaded
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.beginPath();
      this.ctx.arc(
        x + this.gridSize / 2,
        y + this.gridSize / 2,
        this.gridSize / 2,
        0,
        Math.PI * 2
      );
      this.ctx.fill();
    }

    // Draw food sprite
    if (this.currentFoodSprite?.sprite) {
      const foodX = this.food.x * this.gridSize;
      const foodY = this.food.y * this.gridSize;
      try {
        // Draw food sprite 1.5 times larger
        const foodScale = 1.5;
        const foodOffset = (this.gridSize * (foodScale - 1)) / 2;
        this.ctx.drawImage(
          this.currentFoodSprite.sprite,
          foodX - foodOffset,
          foodY - foodOffset,
          this.gridSize * foodScale,
          this.gridSize * foodScale
        );
      } catch (e) {
        console.error('Error drawing food sprite:', e);
        // Fallback to circle if sprite fails
        this.ctx.fillStyle = '#8B4513';
        this.ctx.beginPath();
        this.ctx.arc(
          foodX + this.gridSize / 2,
          foodY + this.gridSize / 2,
          this.gridSize * 0.5, // Make fallback circle larger too
          0,
          Math.PI * 2
        );
        this.ctx.fill();
      }
    }

    // Draw score with improved styling
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = '24px "Press Start 2P", monospace';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';
    this.ctx.fillText(`SCORE: ${this.score}`, 20, 20);

    if (this.gameState === 'gameover') {
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; // Semi-transparent black overlay
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.font = '40px "Press Start 2P", monospace';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(
        'GAME OVER',
        this.canvas.width / 2,
        this.canvas.height / 2 - 30
      );
      
      this.ctx.font = '20px "Press Start 2P", monospace';
      this.ctx.fillText(
        `FINAL SCORE: ${this.score}`,
        this.canvas.width / 2,
        this.canvas.height / 2 + 20
      );
      
      this.ctx.font = '16px "Press Start 2P", monospace';
      this.ctx.fillText(
        'PRESS ENTER TO RESTART',
        this.canvas.width / 2,
        this.canvas.height / 2 + 60
      );
    }
  }

  public restart() {
    this.initializeGame();
    this.start();
  }
} 