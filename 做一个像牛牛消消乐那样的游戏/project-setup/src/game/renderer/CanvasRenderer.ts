import { GameConfiguration } from '../configuration/GameConfiguration';

/**
 * Handles all drawing operations onto the HTML5 canvas.
 * WHY: Isolating rendering logic allows the Game class to focus on
 * state management without being coupled to drawing APIs.
 */
export class CanvasRenderer {
  private readonly renderingContext: CanvasRenderingContext2D;
  private readonly canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d');
    if (context === null) {
      throw new Error('Critical: Unable to acquire 2D rendering context.');
    }
    this.canvas = canvas;
    this.renderingContext = context;
    this.resizeCanvas();
    this.setupResizeListener();
  }

  clear(): void {
    this.renderingContext.fillStyle = GameConfiguration.BACKGROUND_COLOR;
    this.renderingContext.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Exposed for specialized renderers (entities, UI) that compose
   * onto the same context without creating a god class.
   */
  getContext(): CanvasRenderingContext2D {
    return this.renderingContext;
  }

  getDimensions(): { width: number; height: number } {
    return {
      width: this.canvas.width,
      height: this.canvas.height,
    };
  }

  // WHY: Canvas buffer size must match CSS display size multiplied by device pixel ratio
  // to avoid blurry stretching on high-DPI displays (Retina).
  private resizeCanvas(): void {
    const ratio = window.devicePixelRatio || 1;
    const clientRect = this.canvas.getBoundingClientRect();

    this.canvas.width = Math.round(clientRect.width * ratio);
    this.canvas.height = Math.round(clientRect.height * ratio);
    this.renderingContext.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  private setupResizeListener(): void {
    // WHY: Debounce resize to avoid expensive recalculations during continuous drag
    let resizeTimeoutId: ReturnType<typeof setTimeout> | null = null;
    window.addEventListener('resize', () => {
      if (resizeTimeoutId !== null) {
        clearTimeout(resizeTimeoutId);
      }
      resizeTimeoutId = setTimeout(() => {
        this.resizeCanvas();
      }, 100);
    });
  }
}
