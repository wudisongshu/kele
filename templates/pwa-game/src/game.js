const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Responsive canvas
function resize() {
  const size = Math.min(window.innerWidth, window.innerHeight) * 0.9;
  canvas.width = size;
  canvas.height = size;
}
window.addEventListener('resize', resize);
resize();

// Game state
const game = {
  running: false,
  score: 0,
  start() {
    this.running = true;
    this.score = 0;
    this.loop();
  },
  loop() {
    if (!this.running) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Draw a simple grid as placeholder
    const gridSize = 8;
    const cellSize = canvas.width / gridSize;
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= gridSize; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellSize, 0);
      ctx.lineTo(i * cellSize, canvas.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * cellSize);
      ctx.lineTo(canvas.width, i * cellSize);
      ctx.stroke();
    }
    // Draw placeholder text
    ctx.fillStyle = '#fff';
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Game Board - Placeholder', canvas.width / 2, canvas.height / 2);
    requestAnimationFrame(() => this.loop());
  },
};

// Start game
game.start();
