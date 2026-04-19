// WeChat Mini Game entry
wx.onShow(() => {
  console.log('Game shown');
});

// Initialize canvas
const canvas = wx.createCanvas();
const ctx = canvas.getContext('2d');

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

game.start();
