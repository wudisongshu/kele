/**
 * Centralized game constants.
 * WHY: Extracting magic values into configuration prevents hardcoded numbers
 * scattered across modules, making balance tuning and theming trivial.
 */
export const GameConfiguration = {
  CANVAS_ELEMENT_IDENTIFIER: 'game-canvas',
  TARGET_FRAMES_PER_SECOND: 60,
  BACKGROUND_COLOR: '#3498db',
} as const;
