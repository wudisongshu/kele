const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resize() {
  const size = Math.min(window.innerWidth, window.innerHeight) * 0.9;
  canvas.width = size;
  canvas.height = size;
}
window.addEventListener('resize', resize);
resize();

// Game entry point — AI will implement the full game loop
// Requirements from user idea will be implemented here
