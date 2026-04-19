import { GameConfiguration } from './game/configuration/GameConfiguration';
import { InputHandler } from './game/input/InputHandler';
import { CanvasRenderer } from './game/renderer/CanvasRenderer';
import { Game } from './game/Game';

// WHY: Entry point must initialize core systems in deterministic order
// to prevent null reference errors during canvas and context setup.
function initializeApplication(): void {
  const canvas: HTMLCanvasElement | null = document.getElementById(
    GameConfiguration.CANVAS_ELEMENT_IDENTIFIER
  ) as HTMLCanvasElement | null;

  if (canvas === null) {
    throw new Error(
      `Critical: Canvas element with id "${GameConfiguration.CANVAS_ELEMENT_IDENTIFIER}" not found.`
    );
  }

  const renderer = new CanvasRenderer(canvas);
  const inputHandler = new InputHandler(canvas);
  const game = new Game(renderer, inputHandler);

  game.initialize();
  game.start();
}

// WHY: Gracefully surface initialization failures instead of failing silently.
try {
  initializeApplication();
} catch (error) {
  console.error('Failed to initialize game:', error);
}
