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

    // Research / analysis mode
    if (lower.includes('research') || lower.includes('分析') || lower.includes('报告') || lower.includes('分析师')) {
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

    // Game tasks: return a COMPLETE, PLAYABLE single-file game
    if (lower.includes('game') || lower.includes('游戏') || lower.includes('消消乐') || lower.includes('match') || lower.includes('core feature')) {
      // Select game type based on user input
      let gameType: 'match3' | 'snake' | 'breakout' | 'pong' = 'match3';
      if (lower.includes('snake') || lower.includes('贪吃蛇')) gameType = 'snake';
      else if (lower.includes('breakout') || lower.includes('brick') || lower.includes('打砖块')) gameType = 'breakout';
      else if (lower.includes('pong') || lower.includes('ping')) gameType = 'pong';

      return JSON.stringify({
        files: [
          {
            path: 'index.html',
            content: generateGameByType(gameType),
          },
        ],
        notes: `Complete playable single-file ${gameType} game (mock mode). Open index.html directly in browser.`,
      });
    }

    // Setup / initialization tasks
    if (lower.includes('project structure') || lower.includes('初始化') || lower.includes('setup')) {
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
    return JSON.stringify({
      files: [
        {
          path: 'index.html',
          content: `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kele Project</title>
  <style>
    body { font-family: system-ui; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f5f5f5; }
    h1 { color: #333; }
    p { color: #666; }
  </style>
</head>
<body>
  <h1>🥤 Kele Project</h1>
  <p>Configure a real AI provider for full code generation.</p>
</body>
</html>`,
        },
      ],
      notes: 'Mock execution completed. For full AI-generated code, configure a real provider with: kele config --provider <name> --key <key> --url <url> --model <model>',
    });
  }
}

function generateGameByType(gameType: 'match3' | 'snake' | 'breakout' | 'pong'): string {
  if (gameType === 'snake') return generateSnakeGameHtml();
  if (gameType === 'breakout') return generateBreakoutGameHtml();
  if (gameType === 'pong') return generatePongGameHtml();
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
