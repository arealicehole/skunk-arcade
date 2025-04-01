import { GameEngine } from './GameEngine';

type Position = { x: number; y: number };

export class BongGame extends GameEngine {
  // Game settings
  private paddleWidth = 20;
  private paddleHeight = 100;
  private ballSize = 30;
  private paddleSpeed = 8;
  private initialBallSpeed = 5;
  private ballSpeedIncrement = 0.2;
  
  // Game elements
  private player1Pos: Position = { x: 0, y: 0 };
  private player2Pos: Position = { x: 0, y: 0 };
  private ballPos: Position = { x: 0, y: 0 };
  private ballVelocity: Position = { x: 0, y: 0 };
  
  // Scoring
  private player1Score = 0;
  private player2Score = 0;
  
  // Assets
  private bongSprite!: HTMLImageElement;
  private leafSprite!: HTMLImageElement;
  private spritesLoaded = {
    bong: false,
    leaf: false
  };

  constructor(canvas: HTMLCanvasElement) {
    super(canvas);
    this.loadSprites();
    this.initializeGame();
  }

  private loadSprites() {
    // Load bong sprite for paddles
    this.bongSprite = new Image();
    this.bongSprite.onload = () => {
      console.log('Bong sprite loaded successfully');
      this.spritesLoaded.bong = true;
    };
    this.bongSprite.onerror = (e) => {
      console.error('Error loading bong sprite:', e);
    };
    this.bongSprite.src = '/images/bong.png';

    // Load weed leaf sprite for ball
    this.leafSprite = new Image();
    this.leafSprite.onload = () => {
      console.log('Leaf sprite loaded successfully');
      this.spritesLoaded.leaf = true;
    };
    this.leafSprite.onerror = (e) => {
      console.error('Error loading leaf sprite:', e);
    };
    this.leafSprite.src = '/images/leaf.png'; // Will need to create this asset
  }

  private initializeGame() {
    // Set initial positions
    this.player1Pos = {
      x: this.paddleWidth,
      y: (this.canvas.height - this.paddleHeight) / 2
    };
    
    this.player2Pos = {
      x: this.canvas.width - this.paddleWidth * 2,
      y: (this.canvas.height - this.paddleHeight) / 2
    };
    
    this.ballPos = {
      x: this.canvas.width / 2,
      y: this.canvas.height / 2
    };
    
    // Random initial direction
    const angle = Math.random() * Math.PI / 4 - Math.PI / 8 + 
                (Math.random() > 0.5 ? 0 : Math.PI);
    this.ballVelocity = {
      x: this.initialBallSpeed * Math.cos(angle),
      y: this.initialBallSpeed * Math.sin(angle)
    };
    
    // Reset scores
    this.player1Score = 0;
    this.player2Score = 0;
    this.gameState = 'running';
  }

  protected handleKeyDown(event: KeyboardEvent) {
    if (this.gameState === 'gameover') {
      if (event.key === 'Enter') {
        this.restart();
      }
      return;
    }
    
    // Player controls
    switch (event.key) {
      case 'w':
        this.movePlayer1('up');
        break;
      case 's':
        this.movePlayer1('down');
        break;
      case 'ArrowUp':
        this.movePlayer2('up');
        break;
      case 'ArrowDown':
        this.movePlayer2('down');
        break;
    }
  }

  protected handleTouchStart(event: TouchEvent) {
    // Mobile controls implementation
    const touch = event.touches[0];
    const y = touch.clientY;
    
    // Determine if touch is on left or right side of screen
    if (touch.clientX < window.innerWidth / 2) {
      // Left side - Player 1
      if (y < window.innerHeight / 2) {
        this.movePlayer1('up');
      } else {
        this.movePlayer1('down');
      }
    } else {
      // Right side - Player 2
      if (y < window.innerHeight / 2) {
        this.movePlayer2('up');
      } else {
        this.movePlayer2('down');
      }
    }
  }

  private movePlayer1(direction: 'up' | 'down') {
    if (direction === 'up') {
      this.player1Pos.y = Math.max(0, this.player1Pos.y - this.paddleSpeed);
    } else {
      this.player1Pos.y = Math.min(
        this.canvas.height - this.paddleHeight, 
        this.player1Pos.y + this.paddleSpeed
      );
    }
  }

  private movePlayer2(direction: 'up' | 'down') {
    if (direction === 'up') {
      this.player2Pos.y = Math.max(0, this.player2Pos.y - this.paddleSpeed);
    } else {
      this.player2Pos.y = Math.min(
        this.canvas.height - this.paddleHeight, 
        this.player2Pos.y + this.paddleSpeed
      );
    }
  }

  protected update(deltaTime: number) {
    if (this.gameState !== 'running') return;

    // Move the ball
    this.ballPos.x += this.ballVelocity.x;
    this.ballPos.y += this.ballVelocity.y;

    // Wall collisions (top and bottom)
    if (this.ballPos.y < 0 || this.ballPos.y > this.canvas.height - this.ballSize) {
      this.ballVelocity.y = -this.ballVelocity.y;
      // Keep ball in bounds
      this.ballPos.y = Math.max(0, Math.min(this.canvas.height - this.ballSize, this.ballPos.y));
    }

    // Paddle collision - Player 1
    if (this.ballPos.x < this.player1Pos.x + this.paddleWidth && 
        this.ballPos.x + this.ballSize > this.player1Pos.x &&
        this.ballPos.y < this.player1Pos.y + this.paddleHeight &&
        this.ballPos.y + this.ballSize > this.player1Pos.y) {
      
      // Calculate bounce angle based on where ball hits paddle
      const hitPosition = (this.ballPos.y + this.ballSize/2 - this.player1Pos.y) / this.paddleHeight;
      const bounceAngle = (hitPosition - 0.5) * Math.PI / 2; // -45 to 45 degrees
      
      // Set new velocity with slight speed increase
      const speed = Math.sqrt(this.ballVelocity.x * this.ballVelocity.x + 
                             this.ballVelocity.y * this.ballVelocity.y) + this.ballSpeedIncrement;
      
      this.ballVelocity.x = Math.abs(speed * Math.cos(bounceAngle));
      this.ballVelocity.y = speed * Math.sin(bounceAngle);
      
      // Ensure ball doesn't get stuck in paddle
      this.ballPos.x = this.player1Pos.x + this.paddleWidth;
    }

    // Paddle collision - Player 2
    if (this.ballPos.x + this.ballSize > this.player2Pos.x && 
        this.ballPos.x < this.player2Pos.x + this.paddleWidth &&
        this.ballPos.y < this.player2Pos.y + this.paddleHeight &&
        this.ballPos.y + this.ballSize > this.player2Pos.y) {
      
      // Calculate bounce angle based on where ball hits paddle
      const hitPosition = (this.ballPos.y + this.ballSize/2 - this.player2Pos.y) / this.paddleHeight;
      const bounceAngle = (hitPosition - 0.5) * Math.PI / 2; // -45 to 45 degrees
      
      // Set new velocity with slight speed increase
      const speed = Math.sqrt(this.ballVelocity.x * this.ballVelocity.x + 
                             this.ballVelocity.y * this.ballVelocity.y) + this.ballSpeedIncrement;
      
      this.ballVelocity.x = -Math.abs(speed * Math.cos(bounceAngle));
      this.ballVelocity.y = speed * Math.sin(bounceAngle);
      
      // Ensure ball doesn't get stuck in paddle
      this.ballPos.x = this.player2Pos.x - this.ballSize;
    }

    // Scoring
    if (this.ballPos.x < 0) {
      // Player 2 scores
      this.player2Score++;
      this.resetBall(1); // Direction towards player 1
    } else if (this.ballPos.x > this.canvas.width) {
      // Player 1 scores
      this.player1Score++;
      this.resetBall(-1); // Direction towards player 2
    }

    // Check for game over
    if (this.player1Score >= 10 || this.player2Score >= 10) {
      this.gameState = 'gameover';
    }
  }

  private resetBall(direction: number) {
    // Reset ball to center
    this.ballPos = {
      x: this.canvas.width / 2,
      y: this.canvas.height / 2
    };
    
    // Random angle but in the specified direction
    const angle = (Math.random() * Math.PI / 3 - Math.PI / 6) + 
                 (direction > 0 ? 0 : Math.PI);
    
    this.ballVelocity = {
      x: this.initialBallSpeed * Math.cos(angle),
      y: this.initialBallSpeed * Math.sin(angle)
    };
  }

  protected render() {
    // Clear screen
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw center line
    this.ctx.setLineDash([10, 15]);
    this.ctx.strokeStyle = '#FFFFFF';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(this.canvas.width / 2, 0);
    this.ctx.lineTo(this.canvas.width / 2, this.canvas.height);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
    
    // Draw paddles
    if (this.spritesLoaded.bong) {
      // Player 1 paddle (bong sprite)
      this.ctx.drawImage(
        this.bongSprite,
        this.player1Pos.x, 
        this.player1Pos.y,
        this.paddleWidth,
        this.paddleHeight
      );
      
      // Player 2 paddle (bong sprite)
      this.ctx.drawImage(
        this.bongSprite,
        this.player2Pos.x, 
        this.player2Pos.y,
        this.paddleWidth,
        this.paddleHeight
      );
    } else {
      // Fallback rectangles if sprites not loaded
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.fillRect(
        this.player1Pos.x, 
        this.player1Pos.y, 
        this.paddleWidth, 
        this.paddleHeight
      );
      this.ctx.fillRect(
        this.player2Pos.x, 
        this.player2Pos.y, 
        this.paddleWidth, 
        this.paddleHeight
      );
    }
    
    // Draw ball
    if (this.spritesLoaded.leaf) {
      // Leaf sprite with rotation effect
      this.ctx.save();
      this.ctx.translate(
        this.ballPos.x + this.ballSize / 2, 
        this.ballPos.y + this.ballSize / 2
      );
      
      // Rotate based on ball movement
      const angle = Math.atan2(this.ballVelocity.y, this.ballVelocity.x);
      this.ctx.rotate(angle + Math.PI / 2);
      
      this.ctx.drawImage(
        this.leafSprite,
        -this.ballSize / 2,
        -this.ballSize / 2,
        this.ballSize,
        this.ballSize
      );
      this.ctx.restore();
    } else {
      // Fallback circle if sprite not loaded
      this.ctx.fillStyle = '#00FF00';
      this.ctx.beginPath();
      this.ctx.arc(
        this.ballPos.x + this.ballSize / 2,
        this.ballPos.y + this.ballSize / 2,
        this.ballSize / 2,
        0,
        Math.PI * 2
      );
      this.ctx.fill();
    }
    
    // Draw scores
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = '24px "Press Start 2P", monospace';
    this.ctx.textAlign = 'center';
    
    // Player 1 score
    this.ctx.fillText(
      this.player1Score.toString(),
      this.canvas.width / 4,
      50
    );
    
    // Player 2 score
    this.ctx.fillText(
      this.player2Score.toString(),
      this.canvas.width * 3 / 4,
      50
    );
    
    // Game over screen
    if (this.gameState === 'gameover') {
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.font = '40px "Press Start 2P", monospace';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      
      const winner = this.player1Score > this.player2Score ? 'PLAYER 1' : 'PLAYER 2';
      this.ctx.fillText(
        `${winner} WINS!`,
        this.canvas.width / 2,
        this.canvas.height / 2 - 30
      );
      
      this.ctx.font = '16px "Press Start 2P", monospace';
      this.ctx.fillText(
        'PRESS ENTER TO RESTART',
        this.canvas.width / 2,
        this.canvas.height / 2 + 30
      );
    }
  }

  public restart() {
    this.initializeGame();
    this.start();
  }
} 