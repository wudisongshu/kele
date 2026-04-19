import { CanvasRenderer } from './renderer/CanvasRenderer';
import { InputHandler } from './input/InputHandler';

/**
 * Core game controller managing the main loop and state.
 * WHY: Separating loop timing and state updates from rendering and input
 * follows the single-responsibility principle and eases unit testing.
 */
export class Game {
  private readonly renderer: CanvasRenderer;
  private readonly inputHandler: InputHandler;
  private animationFrameId: number | null = null;
  private lastTimestamp: number = 0;
  private isRunning: boolean = false;

  constructor(renderer: CanvasRenderer, inputHandler: InputHandler) {
    this.renderer = renderer;
    this.inputHandler = inputHandler;
  }

  initialize(): void {
    this.inputHandler.onClick((position) => {
      // Stub: will route to board and grid logic in the match-3 module
      console.log('Canvas clicked at:', position);
    });
  }

  start(): void {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;
    this.lastTimestamp = performance.now();
    this.processAnimationFrame(this.lastTimestamp);
  }

  stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private readonly processAnimationFrame = (timestamp: number): void => {
    if (!this.isRunning) {
      return;
    }

    const elapsedMilliseconds = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;

    this.update(elapsedMilliseconds);
    this.draw();

    // WHY: requestAnimationFrame synchronizes with the browser repaint cycle
    // and automatically pauses when the tab is hidden to save battery.
    this.animationFrameId = requestAnimationFrame(this.processAnimationFrame);
  };

  private update(_elapsedMilliseconds: number): void {
    // Reserved for frame-independent game logic (entity movement, animations, match detection)
  }

  private draw(): void {
    this.renderer.clear();
    // TODO: Delegate drawing to board renderer and entity renderers
  }
}
