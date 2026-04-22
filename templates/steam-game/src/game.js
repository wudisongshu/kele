const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = 1280;
  canvas.height = 720;
}
resize();

// Game entry point — AI will implement the full game loop
// Requirements from user idea will be implemented here
