import type { AIAdapter } from './base.js';

/**
 * Mock AI Adapter — returns canned responses for testing and development.
 * Zero cost, zero latency. Used when no real AI keys are configured.
 *
 * CRITICAL: Mock responses MUST contain complete, runnable code.
 * Empty stubs or TODOs are NOT acceptable because they break the user experience.
 */

export class MockAdapter implements AIAdapter {
  readonly name = 'mock';

  isAvailable(): boolean {
    return true;
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    return { ok: true };
  }

  async execute(prompt: string, _onToken?: (token: string) => void): Promise<string> {
    const lower = prompt.toLowerCase();

    // Incubation: generate sub-project structure
    // Detect by unique incubation prompt phrases (NOT present in task execution prompts)
    if (lower.includes('ai incubator') || lower.includes('two-pass') || lower.includes('sub-project structure') || lower.includes('project plan') || lower.includes('孵化')) {
      return generateMockIncubation(lower);
    }

    // Intent classification — echo the user's idea back so mock mode reflects their input
    if (lower.includes('intent classification') || lower.includes('intent:')) {
      // Extract the user input from the prompt (it's always in "User input: \"...\"" format)
      const userInputMatch = prompt.match(/User input: "([^"]+)"/);
      const userInput = userInputMatch ? userInputMatch[1] : 'Create a web project';
      return JSON.stringify({
        intent: 'CREATE',
        projectName: null,
        details: userInput,
      });
    }

    // Research / analysis mode — genre-aware canned responses
    if (lower.includes('research') || lower.includes('分析') || lower.includes('报告') || lower.includes('分析师')) {
      return generateResearchReport(lower);
    }

    // Game tasks: return a COMPLETE, PLAYABLE single-file game
    if (lower.includes('game') || lower.includes('游戏') || lower.includes('消消乐') || lower.includes('match') || lower.includes('core feature')) {
      // Select game type based on user input
      let gameType: 'match3' | 'snake' | 'breakout' | 'pong' | 'tetris' | 'flappy' | 'memory' | 'shooter' | 'tower' | 'platformer' | 'racing' = 'match3';
      if (lower.includes('snake') || lower.includes('贪吃蛇')) gameType = 'snake';
      else if (lower.includes('breakout') || lower.includes('brick') || lower.includes('打砖块')) gameType = 'breakout';
      else if (lower.includes('pong') || lower.includes('ping pong') || lower.includes('ping-pong')) gameType = 'pong';
      else if (lower.includes('tetris') || lower.includes('俄罗斯方块') || lower.includes('方块')) gameType = 'tetris';
      else if (lower.includes('flappy') || lower.includes('像素鸟') || lower.includes('飞')) gameType = 'flappy';
      else if (lower.includes('memory') || lower.includes('记忆') || lower.includes('翻牌') || lower.includes('card')) gameType = 'memory';
      else if (lower.includes('shooter') || lower.includes('射击') || lower.includes('space') || lower.includes('太空')) gameType = 'shooter';
      else if (lower.includes('tower') || lower.includes('塔防') || lower.includes('defense') || lower.includes('防御')) gameType = 'tower';
      else if (lower.includes('platform') || lower.includes('平台') || lower.includes('跳跃') || lower.includes('jump') || lower.includes('mario') || lower.includes('马里奥')) gameType = 'platformer';
      else if (lower.includes('racing') || lower.includes('race') || lower.includes('赛车') || lower.includes('竞速') || lower.includes('car') || lower.includes('车')) gameType = 'racing';

      const gameHtml = generateGameByType(gameType);
      // Inject manifest link and service worker registration into <head>
      const pwaHead = `<link rel="manifest" href="manifest.json"><meta name="theme-color" content="#1a1a2e"><link rel="apple-touch-icon" href="icon-192.png">`;
      const pwaScript = `<script>if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js')</script>`;
      const enhancedHtml = gameHtml.replace('</head>', `${pwaHead}</head>`).replace('</body>', `${pwaScript}</body>`);

      return JSON.stringify({
        files: [
          { path: 'index.html', content: enhancedHtml },
          {
            path: 'manifest.json',
            content: JSON.stringify({
              name: `Kele ${gameType} Game`,
              short_name: gameType,
              start_url: '/',
              display: 'standalone',
              background_color: '#1a1a2e',
              theme_color: '#1a1a2e',
              icons: [{ src: 'icon-192.png', sizes: '192x192' }, { src: 'icon-512.png', sizes: '512x512' }],
            }, null, 2),
          },
          {
            path: 'sw.js',
            content: `const CACHE_NAME = 'kele-game-v1';
const urlsToCache = ['/', '/index.html'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(urlsToCache))));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))))));
self.addEventListener('fetch', e => e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))));`,
          },
          {
            path: 'icon-192.png',
            content: '<!-- SVG icon placeholder: replace with real PNG -->',
          },
        ],
        notes: `Complete playable single-file ${gameType} game with PWA support (mock mode). Open index.html directly in browser.`,
      });
    }

    // Setup / initialization tasks — context-aware based on project type
    if (lower.includes('project structure') || lower.includes('初始化') || lower.includes('setup')) {
      const isGame = lower.includes('game') || lower.includes('游戏');
      const isMiniprogram = lower.includes('小程序') || lower.includes('miniprogram');
      if (isGame) {
        return JSON.stringify({
          files: [
            { path: 'index.html', content: '<!DOCTYPE html>\n<html>\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>Game</title>\n<style>body{margin:0;background:#000}</style>\n</head>\n<body>\n<canvas id="c"></canvas>\n<script>const c=document.getElementById("c"),x=c.getContext("2d");c.width=innerWidth;c.height=innerHeight;</script>\n</body>\n</html>' },
            { path: 'README.md', content: '# Game Project\n\nGenerated by kele AI workflow engine.' },
          ],
          notes: 'Game project initialized with canvas stub',
        });
      }
      if (isMiniprogram) {
        return JSON.stringify({
          files: [
            { path: 'app.json', content: '{\n  "pages": ["pages/index/index"],\n  "window": {\n    "navigationBarTitleText": "Mini Program"\n  }\n}' },
            { path: 'app.js', content: 'App({\n  onLaunch() {\n    console.log("Mini program launched");\n  }\n});' },
            { path: 'README.md', content: '# Mini Program\n\nGenerated by kele AI workflow engine.' },
          ],
          notes: 'Mini program project initialized',
        });
      }
      return JSON.stringify({
        files: [
          { path: 'package.json', content: '{\n  "name": "kele-project",\n  "version": "1.0.0",\n  "type": "module",\n  "scripts": {\n    "dev": "vite",\n    "build": "vite build"\n  },\n  "devDependencies": {\n    "vite": "^5.0.0"\n  }\n}' },
          { path: 'README.md', content: '# Kele Project\n\nGenerated by kele AI workflow engine.' },
        ],
        notes: 'Project initialized with basic structure',
      });
    }

    // Test tasks
    if (lower.includes('test')) {
      return JSON.stringify({
        files: [
          { path: 'tests/app.test.ts', content: 'import { test, expect } from "vitest";\n\ntest("app loads without errors", () => {\n  expect(document.body).toBeDefined();\n});' },
        ],
        notes: 'Tests written',
      });
    }

    // Default: return a complete, runnable HTML page (never empty)
    const isTool = lower.includes('tool') || lower.includes('工具') || lower.includes('calculator') || lower.includes('计算器');
    const title = isTool ? 'Kele Tool' : 'Kele Project';
    const heading = isTool ? '🔧 Kele Tool' : '🥤 Kele Project';
    const desc = isTool ? 'A simple tool placeholder. Configure a real AI provider for full code generation.' : 'Configure a real AI provider for full code generation.';
    return JSON.stringify({
      files: [
        {
          path: 'index.html',
          content: `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: system-ui; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f5f5f5; }
    h1 { color: #333; }
    p { color: #666; }
  </style>
</head>
<body>
  <h1>${heading}</h1>
  <p>${desc}</p>
</body>
</html>`,
        },
      ],
      notes: 'Mock execution completed. For full AI-generated code, configure a real provider with: kele config --provider <name> --key <key> --url <url> --model <model>',
    });
  }
}

function generateResearchReport(lower: string): string {
  if (lower.includes('snake') || lower.includes('贪吃蛇')) {
    return `## 1. 产品分析
经典贪吃蛇游戏，核心玩法是控制蛇移动吃食物变长。目标受众是全年龄段休闲玩家， nostalgia 驱动。

## 2. 变现分析
主要通过插屏广告和复活激励视频。局内广告频率适中，用户体验影响小。

## 3. 市场洞察
贪吃蛇是经典玩法，市场上已有成功案例（如 Slither.io）。关键成功因素：流畅控制、多种模式、在线排行榜。

## 4. 建议
- 核心玩法：经典模式 + 无尽模式 + 限时挑战
- USP：流畅的触摸控制和在线排行榜
- 推荐平台：Web / H5（无需安装，即点即玩）
- 复杂度：低
- MVP功能：经典模式、触摸控制、本地排行榜

## 5. 关键词
贪吃蛇、经典、休闲、H5、广告变现、排行榜`;
  }
  if (lower.includes('tower') || lower.includes('塔防') || lower.includes('defense')) {
    return `## 1. 产品分析
塔防策略游戏，玩家建造防御塔阻止敌人到达终点。目标受众是15-30岁策略游戏爱好者。

## 2. 变现分析
主要通过道具内购（高级防御塔、技能升级）和激励视频（双倍金币、免费复活）。ARPU 潜力较高。

## 3. 市场洞察
塔防游戏生命周期长，玩家粘性强。关键成功因素：塔种类多样、敌人类型丰富、难度曲线平滑、地图编辑器。

## 4. 建议
- 核心玩法：多类型防御塔 + 波次敌人 + 升级系统
- USP：Roguelike 元素（每局随机塔组合）
- 推荐平台：微信小程序 / Steam
- 复杂度：中高
- MVP功能：3种防御塔、10关、升级系统

## 5. 关键词
塔防、策略、Roguelike、升级、内购、广告变现`;
  }
  if (lower.includes('runner') || lower.includes('跑酷') || lower.includes(' endless')) {
    return `## 1. 产品分析
无尽跑酷游戏，玩家控制角色躲避障碍物、收集道具。目标受众是12-25岁休闲玩家。

## 2. 变现分析
主要通过广告变现（复活激励视频、插屏广告）和角色皮肤内购。留存率中等但会话频次高。

## 3. 市场洞察
跑酷游戏上手简单但精通难，关键成功因素：流畅的操控感、渐进难度、角色收集系统。

## 4. 建议
- 核心玩法：自动前进 + 跳跃/滑行/左右移动
- USP：每日挑战关卡 + 角色皮肤系统
- 推荐平台：微信小程序 / H5
- 复杂度：中
- MVP功能：3个角色、无尽模式、排行榜

## 5. 关键词
跑酷、无尽、休闲、微信、H5、广告变现、皮肤、排行榜`;
  }
  // Default: match-3 style report
  return `## 1. 产品分析
这是一款消除类休闲游戏，核心玩法是三消匹配，目标受众是18-35岁休闲玩家。

## 2. 变现分析
主要通过广告变现（插屏广告+激励视频）和道具内购。留存率高，适合流量变现。

## 3. 市场洞察
关键成功因素：简单易上手、关卡难度曲线合理、每日任务和排行榜增加粘性。

## 4. 建议
- 核心玩法：经典三消+特殊道具
- USP：加入社交排行榜和好友助力
- 推荐平台：微信小程序（用户基数大，传播快）
- 复杂度：中等
- MVP功能：50关、3种道具、排行榜

## 5. 关键词
消除游戏、三消、休闲、微信、小程序、广告变现、内购、排行榜`;
}

function generateGameByType(gameType: 'match3' | 'snake' | 'breakout' | 'pong' | 'tetris' | 'flappy' | 'memory' | 'shooter' | 'tower' | 'platformer' | 'racing'): string {
  if (gameType === 'snake') return generateSnakeGameHtml();
  if (gameType === 'breakout') return generateBreakoutGameHtml();
  if (gameType === 'pong') return generatePongGameHtml();
  if (gameType === 'tetris') return generateTetrisGameHtml();
  if (gameType === 'flappy') return generateFlappyGameHtml();
  if (gameType === 'memory') return generateMemoryGameHtml();
  if (gameType === 'shooter') return generateShooterGameHtml();
  if (gameType === 'tower') return generateTowerGameHtml();
  if (gameType === 'platformer') return generatePlatformerGameHtml();
  if (gameType === 'racing') return generateRacingGameHtml();
  return generateMatch3GameHtml();
}

function generateMatch3GameHtml(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>牛牛消消乐</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;background:#1a1a2e;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,sans-serif;user-select:none}
#header{color:#fff;text-align:center;margin-bottom:10px}
#header h1{font-size:20px}
#scoreboard{font-size:14px;color:#ffd700}
#board{background:#16213e;border-radius:10px;padding:6px;box-shadow:0 6px 24px rgba(0,0,0,0.4);position:relative}
canvas{display:block;touch-action:none}
#msg{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#ffd700;font-size:24px;font-weight:bold;text-shadow:0 2px 6px rgba(0,0,0,0.6);pointer-events:none;opacity:0;transition:opacity .3s}
#msg.show{opacity:1}
#ctrl{margin-top:12px;display:flex;gap:10px}
button{padding:8px 18px;border:none;border-radius:6px;font-size:14px;font-weight:600;cursor:pointer;background:#e94560;color:#fff}
button:active{transform:scale(0.95)}
#hint{color:#888;font-size:11px;margin-top:6px}
</style>
</head>
<body>
<div id="header"><h1>🐮 牛牛消消乐</h1><div id="scoreboard">得分: <span id="score">0</span></div></div>
<div id="board"><canvas id="c"></canvas><div id="msg"></div></div>
<div id="ctrl"><button id="btn-restart">🔄 重新开始</button><button id="btn-hint">💡 提示</button></div>
<div id="hint">点击方块，再点击相邻方块交换</div>
<script>
const canvas=document.getElementById('c');
const ctx=canvas.getContext('2d');
const scoreEl=document.getElementById('score');
const msgEl=document.getElementById('msg');
const ROWS=8,COLS=8;
const COLORS=[{f:'#e74c3c',l:'🔴'},{f:'#3498db',l:'🔵'},{f:'#2ecc71',l:'🟢'},{f:'#f1c40f',l:'🟡'},{f:'#9b59b6',l:'🟣'},{f:'#e67e22',l:'🟠'}];
let TS=0,GX=0,GY=0,board=[],sel=null,score=0,anim=false,particles=[];
function resize(){const ms=Math.min(window.innerWidth,window.innerHeight-180);const sz=Math.floor(ms*0.9);canvas.width=sz;canvas.height=sz;canvas.style.width=sz+'px';canvas.style.height=sz+'px';TS=Math.floor(sz/COLS);GX=Math.floor((canvas.width-COLS*TS)/2);GY=Math.floor((canvas.height-ROWS*TS)/2);draw();}
function rc(){return Math.floor(Math.random()*COLORS.length);}
function create(){do{board=[];for(let r=0;r<ROWS;r++){board[r]=[];for(let c=0;c<COLS;c++){let co;do{co=rc();}while((c>=2&&board[r][c-1]===co&&board[r][c-2]===co)||(r>=2&&board[r-1][c]===co&&board[r-2][c]===co));board[r][c]=co;}}}while(findM().length>0);}
function pos(r,c){return{x:GX+c*TS,y:GY+r*TS};}
function drawT(r,c,ci,hi){const p=pos(r,c);const co=COLORS[ci];ctx.save();ctx.translate(p.x+TS/2,p.y+TS/2);ctx.fillStyle='rgba(0,0,0,0.2)';rr(-TS/2+2,-TS/2+3,TS,TS,TS*0.15);ctx.fill();ctx.fillStyle=co.f;rr(-TS/2,-TS/2,TS,TS,TS*0.15);ctx.fill();if(hi){ctx.strokeStyle='#fff';ctx.lineWidth=3;rr(-TS/2,-TS/2,TS,TS,TS*0.15);ctx.stroke();}ctx.fillStyle='rgba(255,255,255,0.15)';rr(-TS/2+3,-TS/2+3,TS-6,TS*0.3,TS*0.08);ctx.fill();ctx.font=\`\${Math.floor(TS*0.5)}px serif\`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(co.l,0,1);ctx.restore();}
function rr(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();}
function draw(){ctx.clearRect(0,0,canvas.width,canvas.height);for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)drawT(r,c,board[r][c],sel&&sel.r===r&&sel.c===c);drawP();}
function findM(){const m=[],M=Array.from({length:ROWS},()=>Array(COLS).fill(false));for(let r=0;r<ROWS;r++)for(let c=0;c<COLS-2;c++){const co=board[r][c];if(co===board[r][c+1]&&co===board[r][c+2]){let l=3;while(c+l<COLS&&board[r][c+l]===co)l++;for(let i=0;i<l;i++)M[r][c+i]=true;}}for(let c=0;c<COLS;c++)for(let r=0;r<ROWS-2;r++){const co=board[r][c];if(co===board[r+1][c]&&co===board[r+2][c]){let l=3;while(r+l<ROWS&&board[r+l][c]===co)l++;for(let i=0;i<l;i++)M[r+i][c]=true;}}for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)if(M[r][c])m.push({r,c});return m;}
function sp(r,c,ci){const p=pos(r,c);for(let i=0;i<6;i++)particles.push({x:p.x+TS/2,y:p.y+TS/2,vx:(Math.random()-0.5)*8,vy:(Math.random()-0.5)*8,life:1,color:COLORS[ci].f,size:Math.random()*5+2});}
function drawP(){for(let i=particles.length-1;i>=0;i--){const p=particles[i];ctx.globalAlpha=p.life;ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;p.x+=p.vx;p.y+=p.vy;p.vy+=0.3;p.life-=0.04;if(p.life<=0)particles.splice(i,1);}if(particles.length>0)requestAnimationFrame(draw);}
async function removeM(matches){if(matches.length===0)return;const pts=matches.length*10+(matches.length>3?(matches.length-3)*20:0);score+=pts;scoreEl.textContent=score;showMsg(\`+\${pts}\`);for(const m of matches)sp(m.r,m.c,board[m.r][m.c]);for(let i=0;i<3;i++){draw();await sleep(50);}for(const m of matches)board[m.r][m.c]=-1;draw();await sleep(120);await gravity();const next=findM();if(next.length>0){await sleep(150);await removeM(next);}}
async function gravity(){let moved=true;while(moved){moved=false;for(let c=0;c<COLS;c++)for(let r=ROWS-1;r>0;r--)if(board[r][c]===-1&&board[r-1][c]!==-1){board[r][c]=board[r-1][c];board[r-1][c]=-1;moved=true;}draw();await sleep(35);}for(let c=0;c<COLS;c++)for(let r=0;r<ROWS;r++)if(board[r][c]===-1)board[r][c]=rc();draw();await sleep(80);}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
function showMsg(t){msgEl.textContent=t;msgEl.classList.add('show');setTimeout(()=>msgEl.classList.remove('show'),700);}
function adj(a,b){return Math.abs(a.r-b.r)+Math.abs(a.c-b.c)===1;}
function swap(a,b){const t=board[a.r][a.c];board[a.r][a.c]=board[b.r][b.c];board[b.r][b.c]=t;}
async function onClick(e){if(anim)return;const rect=canvas.getBoundingClientRect();const x=(e.clientX-rect.left)*(canvas.width/rect.width);const y=(e.clientY-rect.top)*(canvas.height/rect.height);const c=Math.floor((x-GX)/TS);const r=Math.floor((y-GY)/TS);if(r<0||r>=ROWS||c<0||c>=COLS)return;if(!sel){sel={r,c};draw();return;}if(sel.r===r&&sel.c===c){sel=null;draw();return;}if(!adj(sel,{r,c})){sel={r,c};draw();return;}anim=true;const o={r,c};swap(sel,o);draw();await sleep(180);const matches=findM();if(matches.length===0){swap(sel,o);draw();showMsg('❌');await sleep(250);}else{await removeM(matches);}sel=null;anim=false;draw();}
function findHint(){for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){const d=[[0,1],[1,0]];for(const[dr,dc]of d){const nr=r+dr,nc=c+dc;if(nr>=ROWS||nc>=COLS)continue;swap({r,c},{r:nr,c:nc});const m=findM();swap({r,c},{r:nr,c:nc});if(m.length>0)return[{r,c},{r:nr,c:nc}];}}return null;}
function showHint(){const h=findHint();if(!h){showMsg('无可用移动');return;}const p1=pos(h[0].r,h[0].c);const p2=pos(h[1].r,h[1].c);ctx.save();ctx.strokeStyle='#ffd700';ctx.lineWidth=4;ctx.setLineDash([5,4]);rr(p1.x-2,p1.y-2,TS+4,TS+4,6);ctx.stroke();rr(p2.x-2,p2.y-2,TS+4,TS+4,6);ctx.stroke();ctx.restore();setTimeout(()=>{sel=null;draw();},1000);}
function restart(){score=0;scoreEl.textContent='0';sel=null;anim=false;create();draw();}
canvas.addEventListener('pointerdown',onClick);
document.getElementById('btn-restart').addEventListener('click',restart);
document.getElementById('btn-hint').addEventListener('click',showHint);
window.addEventListener('resize',resize);
create();resize();
</script>
</body>
</html>`;
}

function generateSnakeGameHtml(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
<title>贪吃蛇</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;background:#1a1a2e;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:sans-serif}
#header{color:#fff;text-align:center;margin-bottom:10px}
#score{font-size:14px;color:#2ecc71}
canvas{display:block;background:#16213e;border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,0.4)}
#msg{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#fff;font-size:24px;font-weight:bold;pointer-events:none;opacity:0;transition:opacity .3s}
#msg.show{opacity:1}
#ctrl{margin-top:12px;display:flex;gap:10px}
button{padding:8px 18px;border:none;border-radius:6px;font-size:14px;font-weight:600;cursor:pointer;background:#e94560;color:#fff}
</style>
</head>
<body>
<div id="header"><h1>🐍 贪吃蛇</h1><div id="score">得分: <span id="s">0</span></div></div>
<canvas id="c"></canvas>
<div id="msg">Game Over</div>
<div id="ctrl"><button id="restart">🔄 重新开始</button></div>
<script>
const canvas=document.getElementById('c');
const ctx=canvas.getContext('2d');
const scoreEl=document.getElementById('s');
const msgEl=document.getElementById('msg');
const GS=20;
let W,H,snake,food,dir,nextDir,score,loopId,over;
function resize(){const ms=Math.min(window.innerWidth,window.innerHeight-160);const sz=Math.floor(ms/20)*20;canvas.width=sz;canvas.height=sz;W=canvas.width/GS;H=canvas.height/GS;}
function init(){snake=[{x:Math.floor(W/2),y:Math.floor(H/2)}];dir={x:1,y:0};nextDir={x:1,y:0};score=0;scoreEl.textContent='0';over=false;msgEl.classList.remove('show');placeFood();}
function placeFood(){do{food={x:Math.floor(Math.random()*W),y:Math.floor(Math.random()*H)};}while(snake.some(s=>s.x===food.x&&s.y===food.y));}
function update(){if(over)return;dir=nextDir;const head={x:snake[0].x+dir.x,y:snake[0].y+dir.y};if(head.x<0||head.x>=W||head.y<0||head.y>=H||snake.some(s=>s.x===head.x&&s.y===head.y)){over=true;msgEl.textContent='Game Over! 得分: '+score;msgEl.classList.add('show');return;}snake.unshift(head);if(head.x===food.x&&head.y===food.y){score+=10;scoreEl.textContent=score;placeFood();}else{snake.pop();}}
function draw(){ctx.fillStyle='#16213e';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#2ecc71';for(const s of snake){ctx.fillRect(s.x*GS,s.y*GS,GS-1,GS-1);}ctx.fillStyle='#e74c3c';ctx.fillRect(food.x*GS,food.y*GS,GS-1,GS-1);}
function gameLoop(){update();draw();loopId=requestAnimationFrame(gameLoop);}
window.addEventListener('keydown',e=>{if(over)return;if(e.key==='ArrowUp'&&dir.y!==1)nextDir={x:0,y:-1};if(e.key==='ArrowDown'&&dir.y!==-1)nextDir={x:0,y:1};if(e.key==='ArrowLeft'&&dir.x!==1)nextDir={x:-1,y:0};if(e.key==='ArrowRight'&&dir.x!==-1)nextDir={x:1,y:0};});
canvas.addEventListener('touchstart',e=>{if(over)return;const t=e.touches[0];const rect=canvas.getBoundingClientRect();const x=(t.clientX-rect.left)/GS;const y=(t.clientY-rect.top)/GS;const hx=snake[0].x,hy=snake[0].y;if(Math.abs(x-hx)>Math.abs(y-hy)){nextDir={x:x>hx?1:-1,y:0};if(dir.x===-nextDir.x)nextDir=dir;}else{nextDir={x:0,y:y>hy?1:-1};if(dir.y===-nextDir.y)nextDir=dir;}},{passive:true});
document.getElementById('restart').addEventListener('click',()=>{cancelAnimationFrame(loopId);init();gameLoop();});
window.addEventListener('resize',resize);
resize();init();gameLoop();
</script>
</body>
</html>`;
}

function generateBreakoutGameHtml(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
<title>打砖块</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;background:#1a1a2e;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:sans-serif}
#header{color:#fff;text-align:center;margin-bottom:10px}
#score{font-size:14px;color:#f1c40f}
canvas{display:block;background:#16213e;border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,0.4)}
#msg{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#fff;font-size:24px;font-weight:bold;pointer-events:none;opacity:0;transition:opacity .3s}
#msg.show{opacity:1}
#ctrl{margin-top:12px;display:flex;gap:10px}
button{padding:8px 18px;border:none;border-radius:6px;font-size:14px;font-weight:600;cursor:pointer;background:#e94560;color:#fff}
</style>
</head>
<body>
<div id="header"><h1>🧱 打砖块</h1><div id="score">得分: <span id="s">0</span></div></div>
<canvas id="c"></canvas>
<div id="msg"></div>
<div id="ctrl"><button id="restart">🔄 重新开始</button></div>
<script>
const canvas=document.getElementById('c');
const ctx=canvas.getContext('2d');
const scoreEl=document.getElementById('s');
const msgEl=document.getElementById('msg');
let W,H,paddle,ball,bricks,score,over,loopId;
const BRICK_ROWS=5,BRICK_COLS=8;
function resize(){const ms=Math.min(window.innerWidth,window.innerHeight-160);canvas.width=Math.floor(ms*0.9);canvas.height=Math.floor(ms*0.7);W=canvas.width;H=canvas.height;}
function init(){paddle={w:80,h:10,x:W/2-40,y:H-30};ball={x:W/2,y:H/2,r:6,dx:3,dy:-3};score=0;scoreEl.textContent='0';over=false;msgEl.classList.remove('show');bricks=[];const bw=W/BRICK_COLS;const bh=20;for(let r=0;r<BRICK_ROWS;r++)for(let c=0;c<BRICK_COLS;c++)bricks.push({x:c*bw,y:r*bh+40,w:bw-4,h:bh-4,alive:true,color:'hsl('+(r*50)+',70%,50%)'});}
function update(){if(over)return;ball.x+=ball.dx;ball.y+=ball.dy;if(ball.x-ball.r<0||ball.x+ball.r>W)ball.dx=-ball.dx;if(ball.y-ball.r<0)ball.dy=-ball.dy;if(ball.y+ball.r>H){over=true;msgEl.textContent='Game Over! 得分: '+score;msgEl.classList.add('show');return;}if(ball.y+ball.r>paddle.y&&ball.x>paddle.x&&ball.x<paddle.x+paddle.w&&ball.dy>0){ball.dy=-ball.dy;ball.y=paddle.y-ball.r;}for(const b of bricks){if(b.alive&&ball.x>b.x&&ball.x<b.x+b.w&&ball.y>b.y&&ball.y<b.y+b.h){b.alive=false;ball.dy=-ball.dy;score+=10;scoreEl.textContent=score;break;}}if(bricks.every(b=>!b.alive)){over=true;msgEl.textContent='You Win! 得分: '+score;msgEl.classList.add('show');return;}}
function draw(){ctx.fillStyle='#16213e';ctx.fillRect(0,0,W,H);ctx.fillStyle='#3498db';ctx.fillRect(paddle.x,paddle.y,paddle.w,paddle.h);ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(ball.x,ball.y,ball.r,0,Math.PI*2);ctx.fill();for(const b of bricks){if(!b.alive)continue;ctx.fillStyle=b.color;ctx.fillRect(b.x,b.y,b.w,b.h);}}
function gameLoop(){update();draw();loopId=requestAnimationFrame(gameLoop);}
canvas.addEventListener('pointermove',e=>{const rect=canvas.getBoundingClientRect();paddle.x=(e.clientX-rect.left)-paddle.w/2;if(paddle.x<0)paddle.x=0;if(paddle.x+paddle.w>W)paddle.x=W-paddle.w;});
canvas.addEventListener('touchmove',e=>{const rect=canvas.getBoundingClientRect();paddle.x=(e.touches[0].clientX-rect.left)-paddle.w/2;if(paddle.x<0)paddle.x=0;if(paddle.x+paddle.w>W)paddle.x=W-paddle.w;},{passive:true});
document.getElementById('restart').addEventListener('click',()=>{cancelAnimationFrame(loopId);init();gameLoop();});
window.addEventListener('resize',resize);
resize();init();gameLoop();
</script>
</body>
</html>`;
}

function generatePongGameHtml(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
<title>Pong</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;background:#1a1a2e;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:sans-serif}
#header{color:#fff;text-align:center;margin-bottom:10px}
#score{font-size:14px;color:#ffd700}
canvas{display:block;background:#16213e;border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,0.4)}
#ctrl{margin-top:12px;display:flex;gap:10px}
button{padding:8px 18px;border:none;border-radius:6px;font-size:14px;font-weight:600;cursor:pointer;background:#e94560;color:#fff}
</style>
</head>
<body>
<div id="header"><h1>🏓 Pong</h1><div id="score">玩家 <span id="p">0</span> : AI <span id="a">0</span></div></div>
<canvas id="c"></canvas>
<div id="ctrl"><button id="restart">🔄 重新开始</button></div>
<script>
const canvas=document.getElementById('c');
const ctx=canvas.getContext('2d');
const pScoreEl=document.getElementById('p');
const aScoreEl=document.getElementById('a');
let W,H,player,ai,ball,loopId;
function resize(){const ms=Math.min(window.innerWidth,window.innerHeight-160);canvas.width=Math.floor(ms*0.9);canvas.height=Math.floor(ms*0.6);W=canvas.width;H=canvas.height;}
function init(){player={x:10,y:H/2-40,w:10,h:80,score:0};ai={x:W-20,y:H/2-40,w:10,h:80,score:0};ball={x:W/2,y:H/2,r:6,dx:4,dy:3};}
function resetBall(){ball.x=W/2;ball.y=H/2;ball.dx=(Math.random()>0.5?1:-1)*4;ball.dy=(Math.random()*2-1)*3;}
function update(){ball.x+=ball.dx;ball.y+=ball.dy;if(ball.y-ball.r<0||ball.y+ball.r>H)ball.dy=-ball.dy;if(ball.x-ball.r<0){ai.score++;aScoreEl.textContent=ai.score;resetBall();return;}if(ball.x+ball.r>W){player.score++;pScoreEl.textContent=player.score;resetBall();return;}if(ball.x-ball.r<player.x+player.w&&ball.y>player.y&&ball.y<player.y+player.h&&ball.dx<0)ball.dx=-ball.dx;if(ball.x+ball.r>ai.x&&ball.y>ai.y&&ball.y<ai.y+ai.h&&ball.dx>0)ball.dx=-ball.dx;ai.y+=((ball.y-ai.y-ai.h/2)*0.08);if(ai.y<0)ai.y=0;if(ai.y+ai.h>H)ai.y=H-ai.h;}
function draw(){ctx.fillStyle='#16213e';ctx.fillRect(0,0,W,H);ctx.fillStyle='#fff';ctx.fillRect(player.x,player.y,player.w,player.h);ctx.fillRect(ai.x,ai.y,ai.w,ai.h);ctx.beginPath();ctx.arc(ball.x,ball.y,ball.r,0,Math.PI*2);ctx.fill();ctx.setLineDash([5,5]);ctx.beginPath();ctx.moveTo(W/2,0);ctx.lineTo(W/2,H);ctx.stroke();}
function gameLoop(){update();draw();loopId=requestAnimationFrame(gameLoop);}
canvas.addEventListener('pointermove',e=>{const rect=canvas.getBoundingClientRect();player.y=(e.clientY-rect.top)-player.h/2;if(player.y<0)player.y=0;if(player.y+player.h>H)player.y=H-player.h;});
canvas.addEventListener('touchmove',e=>{const rect=canvas.getBoundingClientRect();player.y=(e.touches[0].clientY-rect.top)-player.h/2;if(player.y<0)player.y=0;if(player.y+player.h>H)player.y=H-player.h;},{passive:true});
document.getElementById('restart').addEventListener('click',()=>{cancelAnimationFrame(loopId);init();gameLoop();});
window.addEventListener('resize',resize);
resize();init();gameLoop();
</script>
</body>
</html>`;
}

function generateTetrisGameHtml(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
<title>俄罗斯方块</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;background:#1a1a2e;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:sans-serif}
#header{color:#fff;text-align:center;margin-bottom:10px}
#score{font-size:14px;color:#9b59b6}
canvas{display:block;background:#16213e;border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,0.4)}
#msg{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#fff;font-size:24px;font-weight:bold;pointer-events:none;opacity:0;transition:opacity .3s}
#msg.show{opacity:1}
#ctrl{margin-top:12px;display:flex;gap:10px}
button{padding:8px 18px;border:none;border-radius:6px;font-size:14px;font-weight:600;cursor:pointer;background:#e94560;color:#fff}
</style>
</head>
<body>
<div id="header"><h1>🎮 俄罗斯方块</h1><div id="score">得分: <span id="s">0</span> | 行数: <span id="l">0</span></div></div>
<canvas id="c"></canvas>
<div id="msg">Game Over</div>
<div id="ctrl"><button id="restart">🔄 重新开始</button></div>
<script>
const canvas=document.getElementById('c');
const ctx=canvas.getContext('2d');
const scoreEl=document.getElementById('s');
const linesEl=document.getElementById('l');
const msgEl=document.getElementById('msg');
const COLS=10,ROWS=20,CS=24;
let board,score,lines,over,dropInterval,dropCounter,lastTime,piece;
const SHAPES=[[[1,1,1,1]],[[1,1],[1,1]],[[0,1,0],[1,1,1]],[[1,0,0],[1,1,1]],[[0,0,1],[1,1,1]],[[1,1,0],[0,1,1]],[[0,1,1],[1,1,0]]];
const COLORS=['#00f0f0','#f0f000','#a000f0','#0000f0','#f0a000','#00f000','#f00000'];
function resize(){const mh=window.innerHeight-160;const mw=window.innerWidth;const s=Math.min(Math.floor(mh/ROWS),Math.floor(mw/COLS));const sz=Math.max(16,s);canvas.width=COLS*sz;canvas.height=ROWS*sz;}
function newPiece(){const i=Math.floor(Math.random()*SHAPES.length);return{shape:SHAPES[i],color:COLORS[i],x:Math.floor(COLS/2)-1,y:0};}
function init(){board=Array.from({length:ROWS},()=>Array(COLS).fill(0));score=0;lines=0;scoreEl.textContent='0';linesEl.textContent='0';over=false;msgEl.classList.remove('show');dropInterval=800;dropCounter=0;lastTime=0;piece=newPiece();}
function drawBlock(x,y,color){const s=canvas.width/COLS;ctx.fillStyle=color;ctx.fillRect(x*s,y*s,s-1,s-1);}
function draw(){ctx.fillStyle='#16213e';ctx.fillRect(0,0,canvas.width,canvas.height);for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)if(board[r][c])drawBlock(c,r,board[r][c]);for(let r=0;r<piece.shape.length;r++)for(let c=0;c<piece.shape[r].length;c++)if(piece.shape[r][c])drawBlock(piece.x+c,piece.y+r,piece.color);}
function collide(p){for(let r=0;r<p.shape.length;r++)for(let c=0;c<p.shape[r].length;c++)if(p.shape[r][c]){const nx=p.x+c,ny=p.y+r;if(nx<0||nx>=COLS||ny>=ROWS||(ny>=0&&board[ny][nx]))return true;}return false;}
function merge(){for(let r=0;r<piece.shape.length;r++)for(let c=0;c<piece.shape[r].length;c++)if(piece.shape[r][c])board[piece.y+r][piece.x+c]=piece.color;}
function clearLines(){let cleared=0;for(let r=ROWS-1;r>=0;r--){if(board[r].every(v=>v)){board.splice(r,1);board.unshift(Array(COLS).fill(0));cleared++;r++;}}if(cleared){lines+=cleared;linesEl.textContent=lines;score+=[0,100,300,500,800][cleared];scoreEl.textContent=score;if(dropInterval>150)dropInterval-=30;}}
function rotate(s){const N=s.length;const M=s[0].length;const r=Array.from({length:M},()=>Array(N).fill(0));for(let i=0;i<N;i++)for(let j=0;j<M;j++)r[j][N-1-i]=s[i][j];return r;}
function update(time=0){if(over)return;const dt=time-lastTime;lastTime=time;dropCounter+=dt;if(dropCounter>dropInterval){piece.y++;if(collide(piece)){piece.y--;merge();clearLines();piece=newPiece();if(collide(piece)){over=true;msgEl.textContent='Game Over! 得分: '+score;msgEl.classList.add('show');return;}}dropCounter=0;}draw();requestAnimationFrame(update);}
window.addEventListener('keydown',e=>{if(over)return;if(e.key==='ArrowLeft'){piece.x--;if(collide(piece))piece.x++;}if(e.key==='ArrowRight'){piece.x++;if(collide(piece))piece.x--;}if(e.key==='ArrowDown'){piece.y++;if(collide(piece))piece.y--;else{score+=1;scoreEl.textContent=score;}}if(e.key==='ArrowUp'){const rs=rotate(piece.shape);const old=piece.shape;piece.shape=rs;if(collide(piece)){piece.shape=old;}}if(e.key===' '){while(!collide(piece)){piece.y++;score+=2;}piece.y--;scoreEl.textContent=score;}});
document.getElementById('restart').addEventListener('click',()=>{cancelAnimationFrame(requestAnimationFrame(()=>{}));init();update();});
window.addEventListener('resize',resize);
resize();init();update();
</script>
</body>
</html>`;
}

function generateFlappyGameHtml(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
<title>Flappy Bird</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;background:#1a1a2e;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:sans-serif}
#header{color:#fff;text-align:center;margin-bottom:10px}
#score{font-size:14px;color:#f1c40f}
canvas{display:block;background:#70c5ce;border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,0.4)}
#msg{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#333;font-size:24px;font-weight:bold;pointer-events:none;opacity:0;transition:opacity .3s}
#msg.show{opacity:1}
#ctrl{margin-top:12px;display:flex;gap:10px}
button{padding:8px 18px;border:none;border-radius:6px;font-size:14px;font-weight:600;cursor:pointer;background:#e94560;color:#fff}
</style>
</head>
<body>
<div id="header"><h1>🐦 Flappy Bird</h1><div id="score">得分: <span id="s">0</span></div></div>
<canvas id="c"></canvas>
<div id="msg">点击或按空格跳跃</div>
<div id="ctrl"><button id="restart">🔄 重新开始</button></div>
<script>
const canvas=document.getElementById('c');
const ctx=canvas.getContext('2d');
const scoreEl=document.getElementById('s');
const msgEl=document.getElementById('msg');
let W,H,bird,pipes,score,over,speed,loopId,started;
const GAP=140;
function resize(){const mh=window.innerHeight-160;const mw=window.innerWidth;const ar=9/16;let cw,ch;if(mw/mh>ar){ch=mh;cw=ch*ar;}else{cw=mw;ch=cw/ar;}canvas.width=Math.floor(cw);canvas.height=Math.floor(ch);W=canvas.width;H=canvas.height;}
function init(){bird={x:W*0.2,y:H/2,r:12,vy:0,ay:0.4};pipes=[];score=0;scoreEl.textContent='0';over=false;started=false;msgEl.textContent='点击或按空格跳跃';msgEl.classList.add('show');speed=W*0.003;}
function spawnPipe(){const topH=Math.random()*(H-GAP-80)+40;pipes.push({x:W,topH,bottomY:topH+GAP,passed:false});}
function update(){if(!started)return;if(over)return;bird.vy+=bird.ay;bird.y+=bird.vy;if(bird.y+bird.r>H||bird.y-bird.r<0){over=true;msgEl.textContent='Game Over! 得分: '+score;msgEl.classList.add('show');return;}for(let i=pipes.length-1;i>=0;i--){const p=pipes[i];p.x-=speed;if(p.x+p.w<0){pipes.splice(i,1);continue;}const px=p.x,pw=W*0.15;if(bird.x+bird.r>px&&bird.x-bird.r<px+pw&&(bird.y-bird.r<p.topH||bird.y+bird.r>p.bottomY)){over=true;msgEl.textContent='Game Over! 得分: '+score;msgEl.classList.add('show');return;}if(!p.passed&&p.x+pw<bird.x){p.passed=true;score++;scoreEl.textContent=score;}}if(pipes.length===0||pipes[pipes.length-1].x<W*0.6)spawnPipe();}
function draw(){ctx.fillStyle='#70c5ce';ctx.fillRect(0,0,W,H);ctx.fillStyle='#73bf2e';for(const p of pipes){ctx.fillRect(p.x,0,W*0.15,p.topH);ctx.fillRect(p.x,p.bottomY,W*0.15,H-p.bottomY);}ctx.fillStyle='#f1c40f';ctx.beginPath();ctx.arc(bird.x,bird.y,bird.r,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(bird.x+4,bird.y-3,bird.r*0.3,0,Math.PI*2);ctx.fill();ctx.fillStyle='#333';ctx.beginPath();ctx.arc(bird.x+6,bird.y-3,2,0,Math.PI*2);ctx.fill();}
function gameLoop(){update();draw();loopId=requestAnimationFrame(gameLoop);}
function jump(){if(over)return;if(!started){started=true;msgEl.classList.remove('show');}bird.vy=-6;}
canvas.addEventListener('pointerdown',jump);
window.addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();jump();}});
document.getElementById('restart').addEventListener('click',()=>{cancelAnimationFrame(loopId);init();gameLoop();});
window.addEventListener('resize',resize);
resize();init();gameLoop();
</script>
</body>
</html>`;
}

function generateMockIncubation(lower: string): string {
  const isGame = lower.includes('game') || lower.includes('游戏') || lower.includes('塔防') || lower.includes('贪吃蛇') || lower.includes('方块') || lower.includes('消消乐');
  const isMiniprogram = lower.includes('小程序') || lower.includes('miniprogram') || lower.includes('微信');
  const isTool = lower.includes('工具') || lower.includes('tool') || lower.includes('计算器') || lower.includes('converter');

  if (isGame) {
    return JSON.stringify({
      subProjects: [
        { id: 'game-setup', name: 'Game Setup', description: 'Initialize game project structure', type: 'setup', dependencies: [], monetizationRelevance: 'supporting', estimatedEffort: '1-2 hours', criticalPath: true, riskLevel: 'low', acceptanceCriteria: [{ description: 'index.html exists with canvas', type: 'functional', action: 'verify-file', target: 'index.html', expected: 'file exists', critical: true }] },
        { id: 'game-core', name: 'Game Core', description: 'Build core gameplay loop', type: 'development', dependencies: ['game-setup'], monetizationRelevance: 'core', estimatedEffort: '2-4 days', criticalPath: true, riskLevel: 'medium', acceptanceCriteria: [{ description: 'Game is playable', type: 'functional', action: 'verify-file', target: 'index.html', expected: 'game runs', critical: true }] },
        { id: 'game-ui', name: 'Game UI', description: 'Menus, score, settings', type: 'development', dependencies: ['game-core'], monetizationRelevance: 'core', estimatedEffort: '1-2 days', criticalPath: false, riskLevel: 'low', acceptanceCriteria: [{ description: 'UI screens exist', type: 'visual', action: 'verify-file', target: 'index.html', expected: 'UI rendered', critical: false }] },
        { id: 'deployment', name: 'Deployment', description: 'Deploy game to web', type: 'deployment', dependencies: ['game-core'], monetizationRelevance: 'core', estimatedEffort: '1 day', criticalPath: true, riskLevel: 'low', acceptanceCriteria: [{ description: 'Deploy config exists', type: 'functional', action: 'verify-file', target: '.github/workflows/deploy.yml', expected: 'file exists', critical: true }] },
        { id: 'monetization', name: 'Monetization', description: 'Integrate ads and IAP', type: 'monetization', dependencies: ['deployment'], monetizationRelevance: 'core', estimatedEffort: '1-2 days', criticalPath: true, riskLevel: 'medium', acceptanceCriteria: [{ description: 'Ad code embedded', type: 'functional', action: 'verify-file', target: 'index.html', expected: 'ads present', critical: true }] },
      ],
      riskAssessment: { technicalRisks: ['Game performance on mobile'], marketRisks: ['Saturation in casual games'], timeRisks: ['Feature creep'], mitigation: 'Focus on single core mechanic first' },
      monetizationPath: 'Ad-supported free game with optional IAP for cosmetics and power-ups',
      reasoning: 'Game projects need tight core-loop-first approach',
      selfReviewNotes: 'Prioritized gameplay over polish for MVP',
    });
  }

  if (isMiniprogram) {
    return JSON.stringify({
      subProjects: [
        { id: 'mp-setup', name: 'Mini Program Setup', description: 'Initialize WeChat mini program', type: 'setup', dependencies: [], monetizationRelevance: 'supporting', estimatedEffort: '2-4 hours', criticalPath: true, riskLevel: 'low', acceptanceCriteria: [{ description: 'app.json exists', type: 'functional', action: 'verify-file', target: 'app.json', expected: 'file exists', critical: true }] },
        { id: 'mp-core', name: 'Mini Program Core', description: 'Build pages and logic', type: 'development', dependencies: ['mp-setup'], monetizationRelevance: 'core', estimatedEffort: '2-5 days', criticalPath: true, riskLevel: 'medium', acceptanceCriteria: [{ description: 'Main page renders', type: 'visual', action: 'verify-file', target: 'pages/index/index.wxml', expected: 'file exists', critical: true }] },
        { id: 'mp-deploy', name: 'WeChat Deploy', description: 'Prepare for WeChat submission', type: 'deployment', dependencies: ['mp-core'], monetizationRelevance: 'core', estimatedEffort: '1 day', criticalPath: true, riskLevel: 'low', acceptanceCriteria: [{ description: 'Project config valid', type: 'functional', action: 'verify-file', target: 'project.config.json', expected: 'file exists', critical: true }] },
        { id: 'monetization', name: 'Monetization', description: 'WeChat ad integration', type: 'monetization', dependencies: ['mp-deploy'], monetizationRelevance: 'core', estimatedEffort: '1-2 days', criticalPath: true, riskLevel: 'medium', acceptanceCriteria: [{ description: 'Ad component exists', type: 'functional', action: 'verify-file', target: 'components/ad/ad.wxml', expected: 'file exists', critical: true }] },
      ],
      riskAssessment: { technicalRisks: ['WeChat API changes'], marketRisks: ['Mini program review rejection'], timeRisks: ['Review delays'], mitigation: 'Follow WeChat official guidelines strictly' },
      monetizationPath: 'WeChat banner ads + rewarded video ads',
      reasoning: 'Mini programs have streamlined deployment via WeChat dev tools',
      selfReviewNotes: '4 sub-projects focused on WeChat ecosystem',
    });
  }

  if (isTool) {
    return JSON.stringify({
      subProjects: [
        { id: 'tool-setup', name: 'Tool Setup', description: 'Initialize tool project', type: 'setup', dependencies: [], monetizationRelevance: 'supporting', estimatedEffort: '1-2 hours', criticalPath: true, riskLevel: 'low', acceptanceCriteria: [{ description: 'package.json exists', type: 'functional', action: 'verify-file', target: 'package.json', expected: 'file exists', critical: true }] },
        { id: 'tool-core', name: 'Tool Core', description: 'Build main functionality', type: 'development', dependencies: ['tool-setup'], monetizationRelevance: 'core', estimatedEffort: '1-3 days', criticalPath: true, riskLevel: 'low', acceptanceCriteria: [{ description: 'Tool functions correctly', type: 'functional', action: 'verify-file', target: 'index.html', expected: 'tool works', critical: true }] },
        { id: 'tool-ui', name: 'Tool UI', description: 'Polish user interface', type: 'development', dependencies: ['tool-core'], monetizationRelevance: 'supporting', estimatedEffort: '1 day', criticalPath: false, riskLevel: 'low', acceptanceCriteria: [{ description: 'UI is responsive', type: 'visual', action: 'verify-file', target: 'index.html', expected: 'UI rendered', critical: false }] },
        { id: 'deployment', name: 'Deployment', description: 'Deploy tool to web', type: 'deployment', dependencies: ['tool-core'], monetizationRelevance: 'core', estimatedEffort: '1 day', criticalPath: true, riskLevel: 'low', acceptanceCriteria: [{ description: 'Deploy config exists', type: 'functional', action: 'verify-file', target: '.github/workflows/deploy.yml', expected: 'file exists', critical: true }] },
        { id: 'monetization', name: 'Monetization', description: 'Ad integration or donation', type: 'monetization', dependencies: ['deployment'], monetizationRelevance: 'core', estimatedEffort: '1 day', criticalPath: true, riskLevel: 'low', acceptanceCriteria: [{ description: 'Ad or donation code exists', type: 'functional', action: 'verify-file', target: 'index.html', expected: 'monetization present', critical: true }] },
      ],
      riskAssessment: { technicalRisks: ['Edge case handling'], marketRisks: ['Free alternatives exist'], timeRisks: ['Feature requests'], mitigation: 'Solve one problem extremely well' },
      monetizationPath: 'Ad-supported free tool with optional premium features',
      reasoning: 'Tools have lower dev effort but need exceptional UX',
      selfReviewNotes: 'Kept tool focused on single use case',
    });
  }

  // Default: standard web product
  return JSON.stringify({
    subProjects: [
      { id: 'project-setup', name: 'Project Setup', description: 'Initialize project', type: 'setup', dependencies: [], monetizationRelevance: 'supporting', estimatedEffort: '2-4 hours', criticalPath: true, riskLevel: 'low', acceptanceCriteria: [{ description: 'package.json exists', type: 'functional', action: 'verify-file', target: 'package.json', expected: 'file exists', critical: true }] },
      { id: 'core-dev', name: 'Core Development', description: 'Build core product', type: 'development', dependencies: ['project-setup'], monetizationRelevance: 'core', estimatedEffort: '2-5 days', criticalPath: true, riskLevel: 'medium', acceptanceCriteria: [{ description: 'index.html renders', type: 'visual', action: 'verify-file', target: 'index.html', expected: 'file exists', critical: true }] },
      { id: 'testing', name: 'Testing', description: 'Test and validate', type: 'testing', dependencies: ['core-dev'], monetizationRelevance: 'supporting', estimatedEffort: '1-2 days', criticalPath: false, riskLevel: 'low', acceptanceCriteria: [{ description: 'Tests pass', type: 'functional', action: 'verify-file', target: 'tests', expected: 'tests exist', critical: false }] },
      { id: 'deployment', name: 'Deployment', description: 'Deploy to target platform', type: 'deployment', dependencies: ['core-dev'], monetizationRelevance: 'core', estimatedEffort: '1 day', criticalPath: true, riskLevel: 'low', acceptanceCriteria: [{ description: 'Deploy config exists', type: 'functional', action: 'verify-file', target: '.github/workflows/deploy.yml', expected: 'file exists', critical: true }] },
      { id: 'monetization', name: 'Monetization', description: 'Set up revenue', type: 'monetization', dependencies: ['deployment'], monetizationRelevance: 'core', estimatedEffort: '1-2 days', criticalPath: true, riskLevel: 'medium', acceptanceCriteria: [{ description: 'Ad code exists', type: 'functional', action: 'verify-file', target: 'adsense.html', expected: 'file exists', critical: true }] },
    ],
    riskAssessment: { technicalRisks: ['AI code quality'], marketRisks: ['Competition'], timeRisks: ['Scope creep'], mitigation: 'Keep MVP minimal' },
    monetizationPath: 'Deploy as web app, integrate AdSense for ad revenue',
    reasoning: 'Standard web product pipeline',
    selfReviewNotes: 'Kept lean, 5 sub-projects max',
  });
}


function generateMemoryGameHtml(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>记忆翻牌</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;background:#2d1b4e;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:sans-serif}
#h{color:#fff;margin-bottom:12px;text-align:center}
#h h1{font-size:22px}#stats{color:#ffd700;font-size:14px;margin-top:4px}
#board{display:grid;grid-template-columns:repeat(4,72px);gap:10px}
.card{width:72px;height:72px;background:linear-gradient(135deg,#667eea,#764ba2);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:28px;cursor:pointer;transition:transform .25s,background .25s;user-select:none;box-shadow:0 4px 12px rgba(0,0,0,.3)}
.card.flipped{background:#fff;transform:rotateY(180deg)}
.card.matched{background:#4ade80;pointer-events:none;opacity:.7}
#msg{color:#fff;margin-top:14px;font-size:14px;min-height:20px}
#btn{margin-top:10px;padding:8px 18px;border:none;border-radius:6px;background:#ffd700;color:#2d1b4e;font-weight:bold;cursor:pointer}
</style>
</head>
<body>
<div id="h"><h1>🧠 记忆翻牌</h1><div id="stats">步数: 0 | 时间: 0s</div></div>
<div id="board"></div>
<div id="msg"></div>
<button id="btn" onclick="init()">重新开始</button>
<script>
const emojis=['🍎','🍌','🍇','🍉','🍒','🍓','🍍','🥝'];
let cards=[],flipped=[],matched=0,steps=0,sec=0,timer=null;
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function init(){matched=0;steps=0;sec=0;flipped=[];clearInterval(timer);timer=setInterval(()=>{sec++;document.getElementById('stats').textContent='步数: '+steps+' | 时间: '+sec+'s'},1000);document.getElementById('msg').textContent='';const pairs=[...emojis,...emojis];shuffle(pairs);const b=document.getElementById('board');b.innerHTML='';cards=pairs.map((e,i)=>{const d=document.createElement('div');d.className='card';d.dataset.emoji=e;d.dataset.idx=i;d.onclick=()=>onClick(d);return d});cards.forEach(c=>b.appendChild(c))}
function onClick(c){if(c.classList.contains('flipped')||c.classList.contains('matched')||flipped.length>=2)return;c.classList.add('flipped');c.textContent=c.dataset.emoji;flipped.push(c);if(flipped.length===2){steps++;document.getElementById('stats').textContent='步数: '+steps+' | 时间: '+sec+'s';setTimeout(checkMatch,500)}}
function checkMatch(){const[a,b]=flipped;if(a.dataset.emoji===b.dataset.emoji){a.classList.add('matched');b.classList.add('matched');matched+=2;if(matched===cards.length){clearInterval(timer);document.getElementById('msg').textContent='🎉 恭喜通关! 用时'+sec+'秒, '+steps+'步'}}else{a.classList.remove('flipped');b.classList.remove('flipped');a.textContent='';b.textContent=''}flipped=[]}
init();
</script>
</body>
</html>`;
}

function generateShooterGameHtml(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>太空射击</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;background:#000;display:flex;flex-direction:column;align-items:center;font-family:sans-serif}
#h{color:#fff;text-align:center;padding:6px}
#h h1{font-size:20px}#s{color:#ffd700;font-size:14px}
canvas{display:block;background:#0a0a1a;border:1px solid #333}
#msg{color:#fff;margin-top:6px;font-size:14px;min-height:20px}
#btn{margin-top:6px;padding:6px 16px;border:none;border-radius:6px;background:#ff4757;color:#fff;font-weight:bold;cursor:pointer}
</style>
</head>
<body>
<div id="h"><h1>🚀 太空射击</h1><div id="s">得分: 0 | 生命: ❤️❤️❤️</div></div>
<canvas id="c" width="360" height="520"></canvas>
<div id="msg"></div>
<button id="btn" onclick="start()">开始游戏</button>
<script>
const c=document.getElementById('c'),x=c.getContext('2d');
let ship,bullets=[],enemies=[],score=0,lives=3,over=false,frame=0,playing=false;
function start(){ship={x:160,y:460,w:40,h:30};bullets=[];enemies=[];score=0;lives=3;over=false;frame=0;playing=true;document.getElementById('msg').textContent='';document.getElementById('btn').style.display='none';loop()}
function loop(){if(!playing)return;frame++;x.fillStyle='#0a0a1a';x.fillRect(0,0,c.width,c.height);
// stars
for(let i=0;i<30;i++){x.fillStyle='rgba(255,255,255,'+(0.3+Math.random()*0.5)+')';x.fillRect(((i*37+frame*0.5)%c.width),((i*53+frame)%c.height),1,1)}
// ship
x.fillStyle='#00d2ff';x.fillRect(ship.x,ship.y,ship.w,ship.h);x.fillStyle='#ff0';x.fillRect(ship.x+15,ship.y-6,10,6);
// bullets
x.fillStyle='#ffeb3b';for(let i=bullets.length-1;i>=0;i--){const b=bullets[i];b.y-=6;x.fillRect(b.x,b.y,4,10);if(b.y<0)bullets.splice(i,1)}
// enemies
if(frame%40===0){const sz=30;enemies.push({x:Math.random()*(c.width-sz),y:-sz,w:sz,h:sz,speed:1.5+Math.random()*1.5})}
for(let i=enemies.length-1;i>=0;i--){const e=enemies[i];e.y+=e.speed;x.fillStyle='#ff4757';x.fillRect(e.x,e.y,e.w,e.h);x.fillStyle='#fff';x.font='16px sans-serif';x.fillText('👾',e.x+4,e.y+22);if(e.y>c.height){enemies.splice(i,1);lives--;if(lives<=0)endGame()}}
// collisions
for(let i=bullets.length-1;i>=0;i--){for(let j=enemies.length-1;j>=0;j--){const b=bullets[i],e=enemies[j];if(b&&e&&b.x<e.x+e.w&&b.x+4>e.x&&b.y<e.y+e.h&&b.y+10>e.y){bullets.splice(i,1);enemies.splice(j,1);score+=10;break}}}
document.getElementById('s').textContent='得分: '+score+' | 生命: '+Array(lives).fill('❤️').join('');
if(!over)requestAnimationFrame(loop)}
function endGame(){over=true;playing=false;document.getElementById('msg').textContent='💥 游戏结束! 最终得分: '+score;document.getElementById('btn').style.display='inline-block';document.getElementById('btn').textContent='再玩一次'}
// controls
c.addEventListener('touchmove',e=>{e.preventDefault();const r=c.getBoundingClientRect();const t=e.touches[0];ship.x=t.clientX-r.left-ship.w/2;if(ship.x<0)ship.x=0;if(ship.x>c.width-ship.w)ship.x=c.width-ship.w},{passive:false});
c.addEventListener('click',()=>{if(playing)bullets.push({x:ship.x+ship.w/2-2,y:ship.y})});
document.addEventListener('keydown',e=>{if(!playing)return;if(e.key==='ArrowLeft')ship.x-=15;if(e.key==='ArrowRight')ship.x+=15;if(e.key===' '||e.key==='ArrowUp')bullets.push({x:ship.x+ship.w/2-2,y:ship.y});if(ship.x<0)ship.x=0;if(ship.x>c.width-ship.w)ship.x=c.width-ship.w});
</script>
</body>
</html>`;
}


function generateTowerGameHtml(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>塔防游戏</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;background:#1a1a2e;display:flex;flex-direction:column;align-items:center;font-family:sans-serif}
#h{color:#fff;text-align:center;padding:6px}
#h h1{font-size:20px}#s{color:#ffd700;font-size:14px}
canvas{display:block;background:#0f3460;border:2px solid #16213e;border-radius:4px}
#msg{color:#fff;margin-top:6px;font-size:14px;min-height:20px}
#btn{margin-top:6px;padding:6px 16px;border:none;border-radius:6px;background:#e94560;color:#fff;font-weight:bold;cursor:pointer}
</style>
</head>
<body>
<div id="h"><h1>🏰 塔防游戏</h1><div id="s">金币: 100 | 生命: 20 | 波次: 1</div></div>
<canvas id="c" width="600" height="400"></canvas>
<div id="msg">点击地图放置箭塔（50金币）</div>
<button id="btn" onclick="startWave()">开始下一波</button>
<script>
const c=document.getElementById('c'),x=c.getContext('2d');
const path=[{x:0,y:200},{x:150,y:200},{x:150,y:100},{x:300,y:100},{x:300,y:300},{x:450,y:300},{x:450,y:200},{x:600,y:200}];
let gold=100,lives=20,wave=1,enemies=[],towers=[],projectiles=[],playing=false,frame=0;
function drawMap(){x.fillStyle='#0f3460';x.fillRect(0,0,c.width,c.height);x.strokeStyle='#1a1a2e';x.lineWidth=20;x.lineCap='round';x.lineJoin='round';x.beginPath();x.moveTo(path[0].x,path[0].y);for(let i=1;i<path.length;i++)x.lineTo(path[i].x,path[i].y);x.stroke();x.strokeStyle='#e94560';x.lineWidth=2;x.stroke()}
function startWave(){if(playing)return;playing=true;let count=5+wave*2;let spawned=0;const sp=setInterval(()=>{if(spawned>=count){clearInterval(sp);return}enemies.push({x:path[0].x,y:path[0].y,w:16,h:16,speed:1+wave*0.2,hp:20+wave*5,maxHp:20+wave*5,pathIdx:0,gold:10});spawned++},800)}
function update(){if(!playing&&enemies.length===0)return;frame++;x.clearRect(0,0,c.width,c.height);drawMap();
for(const t of towers){x.fillStyle='#2ecc71';x.fillRect(t.x-12,t.y-12,24,24);x.fillStyle='#fff';x.font='12px sans-serif';x.fillText('🏹',t.x-6,t.y+4);if(frame%40===0){const target=enemies.find(e=>Math.hypot(e.x-t.x,e.y-t.y)<120);if(target)projectiles.push({x:t.x,y:t.y,tx:target.x,ty:target.y,speed:6,dmg:15})}}
for(let i=projectiles.length-1;i>=0;i--){const p=projectiles[i];const dx=p.tx-p.x,dy=p.ty-p.y,dist=Math.hypot(dx,dy);if(dist<8){projectiles.splice(i,1);const hit=enemies.find(e=>Math.hypot(e.x-p.tx,e.y-p.ty)<20);if(hit){hit.hp-=p.dmg;if(hit.hp<=0){gold+=hit.gold;enemies=enemies.filter(e=>e!==hit)}}continue}p.x+=dx/dist*p.speed;p.y+=dy/dist*p.speed;x.fillStyle='#ffeb3b';x.beginPath();x.arc(p.x,p.y,3,0,Math.PI*2);x.fill()}
for(let i=enemies.length-1;i>=0;i--){const e=enemies[i];const target=path[e.pathIdx+1];if(!target){enemies.splice(i,1);lives--;continue}const dx=target.x-e.x,dy=target.y-e.y,dist=Math.hypot(dx,dy);if(dist<5){e.pathIdx++;if(e.pathIdx>=path.length-1){enemies.splice(i,1);lives--;continue}}e.x+=dx/dist*e.speed;e.y+=dy/dist*e.speed;x.fillStyle='#e74c3c';x.fillRect(e.x-e.w/2,e.y-e.h/2,e.w,e.h);x.fillStyle='#fff';x.font='10px sans-serif';x.fillText('👾',e.x-5,e.y+3);const hpPct=e.hp/e.maxHp;x.fillStyle='#333';x.fillRect(e.x-10,e.y-e.h/2-6,20,4);x.fillStyle=hpPct>0.5?'#2ecc71':'#e74c3c';x.fillRect(e.x-10,e.y-e.h/2-6,20*hpPct,4)}
if(lives<=0){playing=false;document.getElementById('msg').textContent='💥 游戏结束! 最终波次: '+wave;document.getElementById('btn').textContent='重新开始';document.getElementById('btn').onclick=()=>location.reload();return}
if(playing&&enemies.length===0){playing=false;wave++;document.getElementById('msg').textContent='🎉 第 '+(wave-1)+' 波完成! 点击开始下一波'}
document.getElementById('s').textContent='金币: '+gold+' | 生命: '+lives+' | 波次: '+wave;requestAnimationFrame(update)}
c.addEventListener('click',e=>{if(playing)return;const r=c.getBoundingClientRect();const cx=(e.clientX-r.left)*(c.width/r.width);const cy=(e.clientY-r.top)*(c.height/r.height);if(gold<50){document.getElementById('msg').textContent='金币不足!';return}for(const p of path){if(Math.hypot(p.x-cx,p.y-cy)<20){document.getElementById('msg').textContent='不能在路径上建塔!';return}}for(const t of towers){if(Math.hypot(t.x-cx,t.y-cy)<24){document.getElementById('msg').textContent='位置已被占用!';return}}towers.push({x:cx,y:cy});gold-=50;document.getElementById('msg').textContent='箭塔已放置! 剩余金币: '+gold;update()});
drawMap();update();
</script>
</body>
</html>`;
}

function generatePlatformerGameHtml(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>平台跳跃</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;background:#1a1a2e;display:flex;flex-direction:column;align-items:center;font-family:sans-serif}
#h{color:#fff;text-align:center;padding:6px}
#h h1{font-size:20px}#s{color:#ffd700;font-size:14px}
canvas{display:block;background:#87CEEB;border:2px solid #16213e;border-radius:4px}
#msg{color:#fff;margin-top:6px;font-size:14px;min-height:20px}
#btn{margin-top:6px;padding:6px 16px;border:none;border-radius:6px;background:#e94560;color:#fff;font-weight:bold;cursor:pointer}
</style>
</head>
<body>
<div id="h"><h1>🦊 平台跳跃</h1><div id="s">得分: 0 | 生命: ❤️❤️❤️</div></div>
<canvas id="c" width="640" height="360"></canvas>
<div id="msg">方向键移动，空格跳跃</div>
<button id="btn" onclick="restart()">重新开始</button>
<script>
const c=document.getElementById('c'),x=c.getContext('2d');
const gravity=0.6,jumpForce=-12,speed=4;
let player,platforms,coins,enemies,score=0,lives=3,keys={},camX=0,over=false;
function init(){player={x:50,y:200,w:24,h:24,vx:0,vy:0,grounded:false};score=0;lives=3;over=false;camX=0;
platforms=[{x:0,y:300,w:200,h:20},{x:250,y:260,w:120,h:20},{x:420,y:220,w:100,h:20},{x:580,y:180,w:150,h:20},{x:780,y:260,w:120,h:20},{x:950,y:200,w:100,h:20},{x:1100,y:160,w:200,h:20},{x:1350,y:260,w:120,h:20},{x:1550,y:200,w:300,h:20}];
coins=[{x:280,y:230,r:8},{x:310,y:230,r:8},{x:460,y:190,r:8},{x:640,y:150,r:8},{x:820,y:230,r:8},{x:980,y:170,r:8},{x:1200,y:130,r:8},{x:1400,y:230,r:8}];
enemies=[{x:300,y:236,w:20,h:20,vx:1,minX:250,maxX:370},{x:850,y:236,w:20,h:20,vx:1.5,minX:780,maxX:900},{x:1250,y:136,w:20,h:20,vx:1,minX:1100,maxX:1300}];}
function restart(){init();document.getElementById('msg').textContent='方向键移动，空格跳跃';loop()}
function update(){if(over)return;player.vy+=gravity;player.vx=0;if(keys['ArrowLeft']||keys['a'])player.vx=-speed;if(keys['ArrowRight']||keys['d'])player.vx=speed;player.x+=player.vx;player.y+=player.vy;player.grounded=false;
for(const p of platforms){if(player.x+player.w>p.x&&player.x<p.x+p.w&&player.y+player.h>p.y&&player.y+player.h<p.y+p.vy+10){player.y=p.y-player.h;player.vy=0;player.grounded=true}}
if(player.y>c.height){lives--;if(lives<=0){over=true;document.getElementById('msg').textContent='💥 游戏结束! 得分: '+score;document.getElementById('btn').textContent='再玩一次';return}else{player.x=50;player.y=200;player.vy=0;camX=0}}
camX=Math.max(0,player.x-c.width/2);if(camX>platforms[platforms.length-1].x+c.width-c.width)camX=platforms[platforms.length-1].x+c.width-c.width;
for(let i=coins.length-1;i>=0;i--){const co=coins[i];if(Math.hypot(player.x+player.w/2-co.x,player.y+player.h/2-co.y)<co.r+player.w/2){coins.splice(i,1);score+=10}}
for(const e of enemies){e.x+=e.vx;if(e.x<=e.minX||e.x+20>=e.maxX)e.vx*=-1;if(player.x+player.w>e.x&&player.x<e.x+20&&player.y+player.h>e.y&&player.y<e.y+20){if(player.vy>0&&player.y+player.h<e.y+15){score+=50;player.vy=jumpForce*0.7;e.x=-9999}else{lives--;player.x=50;player.y=200;player.vy=0;camX=0;if(lives<=0){over=true;document.getElementById('msg').textContent='💥 游戏结束! 得分: '+score;return}}}}
if(player.x>platforms[platforms.length-1].x+100){over=true;score+=100;document.getElementById('msg').textContent='🎉 通关! 最终得分: '+score;return}
draw();requestAnimationFrame(update)}
function draw(){x.save();x.translate(-camX,0);x.fillStyle='#87CEEB';x.fillRect(camX,0,c.width,c.height);x.fillStyle='#2ecc71';for(const p of platforms){x.fillRect(p.x,p.y,p.w,p.h);x.fillStyle='#27ae60';x.fillRect(p.x,p.y,p.w,4);x.fillStyle='#2ecc71'}
x.fillStyle='#e67e22';x.fillRect(player.x,player.y,player.w,player.h);x.fillStyle='#f39c12';x.fillRect(player.x,player.y,player.w,6);x.fillStyle='#fff';x.font='14px sans-serif';x.fillText('🦊',player.x+2,player.y+18);
for(const co of coins){x.fillStyle='#ffd700';x.beginPath();x.arc(co.x,co.y,co.r,0,Math.PI*2);x.fill();x.strokeStyle='#e67e22';x.lineWidth=1;x.stroke()}
for(const e of enemies){x.fillStyle='#e74c3c';x.fillRect(e.x,e.y,e.w,e.h);x.fillStyle='#fff';x.font='12px sans-serif';x.fillText('👾',e.x+2,e.y+15)}
x.restore();document.getElementById('s').textContent='得分: '+score+' | 生命: '+Array(lives).fill('❤️').join('')}
function loop(){update()}
document.addEventListener('keydown',e=>{keys[e.key]=true;if(e.key===' '||e.key==='ArrowUp'||e.key==='w'){if(player.grounded){player.vy=jumpForce;player.grounded=false}}e.preventDefault()});
document.addEventListener('keyup',e=>keys[e.key]=false);
init();loop();
</script>
</body>
</html>`;
}

function generateRacingGameHtml(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>赛车游戏</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;background:#1a1a2e;display:flex;flex-direction:column;align-items:center;font-family:sans-serif}
#h{color:#fff;text-align:center;padding:6px}
#h h1{font-size:20px}#s{color:#ffd700;font-size:14px}
canvas{display:block;background:#333;border:2px solid #16213e;border-radius:4px}
#msg{color:#fff;margin-top:6px;font-size:14px;min-height:20px}
#btn{margin-top:6px;padding:6px 16px;border:none;border-radius:6px;background:#e94560;color:#fff;font-weight:bold;cursor:pointer}
</style>
</head>
<body>
<div id="h"><h1>🏎️ 赛车游戏</h1><div id="s">得分: 0 | 速度: 0 km/h</div></div>
<canvas id="c" width="360" height="520"></canvas>
<div id="msg">左右方向键控制赛车</div>
<button id="btn" onclick="restart()">重新开始</button>
<script>
const c=document.getElementById('c'),x=c.getContext('2d');
const roadW=200,laneCount=3;
let car,obstacles,score=0,speed=0,over=false,keys={},roadY=0;
function init(){car={x:c.width/2,y:c.height-80,w:30,h:50};obstacles=[];score=0;speed=0;over=false;roadY=0;}
function restart(){init();document.getElementById('msg').textContent='左右方向键控制赛车';loop()}
function update(){if(over)return;
if(keys['ArrowLeft'])car.x-=6;if(keys['ArrowRight'])car.x+=6;
if(car.x<80+car.w/2)car.x=80+car.w/2;if(car.x>c.width-80-car.w/2)car.x=c.width-80-car.w/2;
speed=Math.min(200,5+score*0.5);roadY=(roadY+speed*0.1)%40;score+=Math.floor(speed/20);
if(Math.random()<0.02){const lane=Math.floor(Math.random()*laneCount);const lx=80+roadW/6+lane*(roadW/3);obstacles.push({x:lx,y:-50,w:30,h:30,speed:speed*0.08+2})}
for(let i=obstacles.length-1;i>=0;i--){const o=obstacles[i];o.y+=o.speed;if(o.y>c.height){obstacles.splice(i,1);continue}if(Math.abs(car.x-o.x)<(car.w+o.w)/2&&Math.abs(car.y-o.y)<(car.h+o.h)/2){over=true;document.getElementById('msg').textContent='💥 撞车了! 最终得分: '+score;document.getElementById('btn').textContent='再玩一次';return}}
draw();document.getElementById('s').textContent='得分: '+score+' | 速度: '+Math.floor(speed)+' km/h';requestAnimationFrame(update)}
function draw(){x.fillStyle='#2d5a27';x.fillRect(0,0,c.width,c.height);x.fillStyle='#444';x.fillRect(80,0,roadW,c.height);x.fillStyle='#fff';for(let i=-1;i<c.height/40+1;i++){const y=i*40+roadY;x.fillRect(c.width/2-2,y,4,20)}
x.fillStyle='#e74c3c';x.fillRect(car.x-car.w/2,car.y-car.h/2,car.w,car.h);x.fillStyle='#c0392b';x.fillRect(car.x-car.w/2,car.y-car.h/2,car.w,8);x.fillStyle='#f39c12';x.fillRect(car.x-8,car.y-car.h/2-3,6,4);x.fillRect(car.x+2,car.y-car.h/2-3,6,4);x.fillStyle='#fff';x.font='16px sans-serif';x.fillText('🏎️',car.x-10,car.y+5);
for(const o of obstacles){x.fillStyle='#e67e22';x.fillRect(o.x-o.w/2,o.y-o.h/2,o.w,o.h);x.fillStyle='#fff';x.font='14px sans-serif';x.fillText('🚧',o.x-7,o.y+4)}}
function loop(){update()}
document.addEventListener('keydown',e=>{keys[e.key]=true});
document.addEventListener('keyup',e=>{keys[e.key]=false});
init();loop();
</script>
</body>
</html>`;
}
