export class GameEngine {
  protected canvas: HTMLCanvasElement;
  protected ctx: CanvasRenderingContext2D;
  private animationFrameId: number = 0;
  private lastTimestamp: number = 0;
  protected gameState: 'running' | 'paused' | 'gameover' = 'running';

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not get canvas context');
    this.ctx = context;
    this.setupEventListeners();
  }

  protected setupEventListeners() {
    window.addEventListener('keydown', this.handleKeyDown.bind(this));
    window.addEventListener('touchstart', this.handleTouchStart.bind(this));
    window.addEventListener('touchmove', this.handleTouchMove.bind(this));
  }

  protected handleKeyDown(event: KeyboardEvent) {
    // To be implemented by specific games
  }

  protected handleTouchStart(event: TouchEvent) {
    // To be implemented by specific games
  }

  protected handleTouchMove(event: TouchEvent) {
    // To be implemented by specific games
  }

  protected update(deltaTime: number) {
    // To be implemented by specific games
  }

  protected render() {
    // To be implemented by specific games
  }

  protected clearScreen() {
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  public start() {
    this.gameState = 'running';
    this.gameLoop(0);
  }

  public pause() {
    this.gameState = 'paused';
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  public resume() {
    if (this.gameState === 'paused') {
      this.gameState = 'running';
      this.gameLoop(0);
    }
  }

  private gameLoop(timestamp: number) {
    if (this.gameState !== 'running') return;

    const deltaTime = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;

    this.update(deltaTime);
    this.clearScreen();
    this.render();

    this.animationFrameId = requestAnimationFrame(this.gameLoop.bind(this));
  }

  public cleanup() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener('keydown', this.handleKeyDown.bind(this));
    window.removeEventListener('touchstart', this.handleTouchStart.bind(this));
    window.removeEventListener('touchmove', this.handleTouchMove.bind(this));
  }
  
  public restart() {
    // This method is meant to be overridden by specific game implementations
    // Default implementation just restarts the game loop
    this.gameState = 'running';
    this.gameLoop(0);
  }
} 