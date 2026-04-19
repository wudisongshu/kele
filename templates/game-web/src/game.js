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
    // TODO: implement game rendering
    requestAnimationFrame(() => this.loop());
  },
};

// Start game
game.start();
