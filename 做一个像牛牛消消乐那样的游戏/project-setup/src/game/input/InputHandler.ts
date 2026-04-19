/**
 * Encapsulates pointer and touch input translation.
 * WHY: Raw DOM events are normalized here so the Game class receives
 * canvas-relative coordinates without importing browser-specific APIs.
 */
export class InputHandler {
  private readonly canvas: HTMLCanvasElement;
  private clickHandlers: Array<(position: { x: number; y: number }) => void> = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.bindEvents();
  }

  onClick(handler: (position: { x: number; y: number }) => void): void {
    this.clickHandlers.push(handler);
  }

  private calculateCanvasPosition(
    clientX: number,
    clientY: number
  ): { x: number; y: number } {
    const clientRect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / clientRect.width;
    const scaleY = this.canvas.height / clientRect.height;

    return {
      x: (clientX - clientRect.left) * scaleX,
      y: (clientY - clientRect.top) * scaleY,
    };
  }

  private bindEvents(): void {
    this.canvas.addEventListener('pointerdown', (event: PointerEvent) => {
      // Ignore non-primary pointers (e.g., secondary pen buttons)
      if (!event.isPrimary) {
        return;
      }

      const position = this.calculateCanvasPosition(event.clientX, event.clientY);
      this.clickHandlers.forEach((handler) => handler(position));
    });

    // WHY: Prevent browser defaults (scroll and zoom) so the canvas remains interactive on mobile
    this.canvas.addEventListener(
      'touchstart',
      (event: TouchEvent) => {
        event.preventDefault();
      },
      { passive: false }
    );
  }
}
