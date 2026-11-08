import { TILE, SIZE, CLASSES, SLOTS, createGame, stats, xpNeeded, tick, attack, castSkill, drinkPotion, equipItem, itemDescription, nextFloor, serializeGame, restoreGame } from './game.js';

const $ = id => document.getElementById(id);
const canvas = $('world'), ctx = canvas.getContext('2d', { alpha: false });
const mini = $('minimap'), mctx = mini.getContext('2d');
const SAVE_KEY = 'hellforge-save-v1';
const roman = n => { const nums = ['I','II','III','IV','V','VI','VII','VIII','IX','X']; return nums[n - 1] || String(n); };
let game = null, selectedClass = 'knight', screen = 'title', inventoryOpen = false;
let viewW = 0, viewH = 0, dpr = 1, tile = TILE, camera = { x: 0, y: 0 };
let lastFrame = performance.now(), lastHud = 0, saveClock = 0, previousEvent = null;
let discovered = new Set();
const keys = new Set();
const pointer = { down: false, aim: null, joystickId: null, attackId: null, joyX: 0, joyY: 0 };

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  viewW = window.innerWidth; viewH = window.innerHeight;
  tile = viewW < 760 ? 43 : 48;
  canvas.width = Math.ceil(viewW * dpr); canvas.height = Math.ceil(viewH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize); resize();

function hash(x, y, salt = 0) { let h = Math.imul(x + 71, 374761393) + Math.imul(y + salt + 37, 668265263); h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967295; }
const sx = x => (x - camera.x) * tile + viewW / 2;
const sy = y => (y - camera.y) * tile + viewH / 2;
const worldAt = (x, y) => ({ x: (x - viewW / 2) / tile + camera.x, y: (y - viewH / 2) / tile + camera.y });
function line(x1, y1, x2, y2, color, width = 1) { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); }
function ellipse(x, y, rx, ry, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2); ctx.fill(); }
function polygon(points, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(points[0][0],points[0][1]); for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);ctx.closePath();ctx.fill(); }

function drawFloor(x, y) {
  const px = sx(x), py = sy(y), h = hash(x,y);
  ctx.fillStyle = h < .1 ? '#262625' : h < .48 ? '#292929' : '#2b2b2a'; ctx.fillRect(px,py,tile+1,tile+1);
  ctx.strokeStyle = '#41403a72'; ctx.lineWidth = 1;
  ctx.strokeRect(px+.5,py+.5,tile,tile);
  if (h < .07) {
    ctx.fillStyle = '#3b3026'; ctx.fillRect(px+tile*.18,py+tile*.28,tile*.64,tile*.09);
    ctx.fillStyle = '#17191a'; ctx.fillRect(px+tile*.21,py+tile*.39,tile*.58,tile*.3);
    for(let i=0;i<4;i++)line(px+tile*(.25+i*.14),py+tile*.41,px+tile*(.25+i*.14),py+tile*.68,'#483d2a',1);
  } else if (h > .92) {
    line(px+tile*.16,py+tile*.25,px+tile*.46,py+tile*.48,'#171919',2);
    line(px+tile*.46,py+tile*.48,px+tile*.64,py+tile*.39,'#171919',2);
    line(px+tile*.46,py+tile*.48,px+tile*.71,py+tile*.77,'#171919',2);
  } else if (h > .81) {
    ctx.fillStyle = '#504c3d'; ctx.fillRect(px+tile*.12,py+tile*.16,3,2);
    ctx.fillRect(px+tile*.73,py+tile*.7,4,2);
  }
  if (h > .72 && h < .76) {
    ctx.strokeStyle='#51463b'; ctx.lineWidth=2;ctx.strokeRect(px+tile*.12,py+tile*.12,tile*.76,tile*.76);
    line(px+tile*.16,py+tile*.5,px+tile*.84,py+tile*.5,'#4f4438',2);
  }
}
function drawWall(x, y) {
  const px=sx(x), py=sy(y), h=hash(x,y,4);
  const south = game.map[y+1]?.[x] === 1, east = game.map[y]?.[x+1] === 1;
  ctx.fillStyle = h < .45 ? '#17191a' : '#1c1d1d'; ctx.fillRect(px,py,tile+1,tile+1);
  if (south || east) {
    ctx.fillStyle = '#34302a'; ctx.fillRect(px,py,tile+1,tile*.32);
    ctx.fillStyle = '#201d1b'; ctx.fillRect(px,py+tile*.32,tile+1,tile*.7);
    ctx.fillStyle = '#4a4034'; ctx.fillRect(px,py+tile*.28,tile+1,3);
    line(px,py+tile*.55,px+tile,py+tile*.55,'#36312c',1);
    line(px+tile*.52,py+tile*.32,px+tile*.52,py+tile*.55,'#39332d',1);
    line(px+tile*.25,py+tile*.55,px+tile*.25,py+tile,'#302b27',1);
    if (south) { ctx.fillStyle='#08090a9a'; ctx.fillRect(px,py+tile*.91,tile,tile*.16); }
    if (h > .943 && south) drawTorch(px+tile*.5,py+tile*.7,game.time+h*7);
  } else {
    ctx.fillStyle = '#242625'; ctx.fillRect(px+2,py+2,tile-4,tile-4);
    ctx.fillStyle = '#33342f'; ctx.fillRect(px+2,py+2,tile-4,3);
  }
}
function drawTorch(x,y,t) {
  line(x,y+10,x,y-4,'#5b4731',3);
  const flicker=Math.sin(t*13)*2;
  const glow=ctx.createRadialGradient(x,y-8,1,x,y-8,35); glow.addColorStop(0,'#ffab4777');glow.addColorStop(1,'#ff6e1000');ctx.fillStyle=glow;ctx.fillRect(x-35,y-43,70,70);
  ellipse(x,y-9,4+flicker*.3,8+flicker,'#e46e25');ellipse(x,y-11,2.2,5,'#ffd47d');
}
function drawShadow(entity, width=14){ellipse(sx(entity.x),sy(entity.y)+6,width,width*.37,'#0009');}
function drawEnemy(e) {
  const x=sx(e.x), y=sy(e.y), z=tile/48;
  drawShadow(e,e.radius*tile*.96);
  if(e.kind==='imp'){
    polygon([[x-10*z,y-5*z],[x-8*z,y-23*z],[x-2*z,y-30*z],[x+3*z,y-21*z],[x+10*z,y-8*z],[x+8*z,y+2*z],[x-8*z,y+2*z]],'#8d3429');
    polygon([[x-8*z,y-21*z],[x-14*z,y-30*z],[x-5*z,y-25*z]],'#b95a37');polygon([[x+6*z,y-20*z],[x+15*z,y-29*z],[x+8*z,y-16*z]],'#b95a37');
    ellipse(x-3*z,y-17*z,2*z,1.6*z,'#ffc766');ellipse(x+3*z,y-17*z,2*z,1.6*z,'#ffc766');
    line(x+7*z,y-3*z,x+16*z,y-13*z,'#7c3429',3*z);
  }else if(e.kind==='skeleton'){
    line(x-7*z,y-8*z,x-13*z,y+1*z,'#b9ae8c',3*z);line(x+7*z,y-8*z,x+13*z,y+1*z,'#b9ae8c',3*z);
    polygon([[x-9*z,y-8*z],[x-7*z,y-23*z],[x+8*z,y-23*z],[x+9*z,y-8*z]],'#8b8b7d');
    for(let i=-1;i<=1;i++)line(x-6*z,y-16*z+i*3*z,x+6*z,y-16*z+i*3*z,'#d4c9a6',1.4*z);
    ellipse(x,y-28*z,7*z,8*z,'#d9cfac');ellipse(x-3*z,y-29*z,2*z,2*z,'#1d1f1e');ellipse(x+3*z,y-29*z,2*z,2*z,'#1d1f1e');
    line(x+12*z,y-3*z,x+20*z,y-28*z,'#a79d82',2.5*z);
  }else if(e.kind==='brute'){
    polygon([[x-18*z,y-7*z],[x-16*z,y-31*z],[x-9*z,y-37*z],[x+12*z,y-35*z],[x+19*z,y-10*z]],'#754d48');
    polygon([[x-18*z,y-25*z],[x-25*z,y-33*z],[x-14*z,y-31*z]],'#aa7060');polygon([[x+16*z,y-24*z],[x+25*z,y-34*z],[x+15*z,y-30*z]],'#aa7060');
    ellipse(x,y-40*z,11*z,9*z,'#9f6d61');ellipse(x-4*z,y-40*z,2*z,2*z,'#ff9c53');ellipse(x+4*z,y-40*z,2*z,2*z,'#ff9c53');
    line(x-20*z,y-17*z,x-25*z,y-2*z,'#90645a',7*z);line(x+20*z,y-17*z,x+26*z,y-2*z,'#90645a',7*z);
  }else if(e.kind==='shaman'){
    polygon([[x-12*z,y+1*z],[x-9*z,y-25*z],[x,y-34*z],[x+9*z,y-25*z],[x+12*z,y+1*z]],'#703b2d');
    polygon([[x-8*z,y-25*z],[x,y-37*z],[x+8*z,y-25*z]],'#c67c40');
    ellipse(x,y-22*z,6*z,6*z,'#9f684a');ellipse(x-2*z,y-23*z,1.3*z,1.3*z,'#ffd776');ellipse(x+2*z,y-23*z,1.3*z,1.3*z,'#ffd776');
    line(x+12*z,y-10*z,x+18*z,y-35*z,'#aa7951',3*z);drawTorch(x+18*z,y-36*z,game.time);
  }else{
    const pulse=1+Math.sin(game.time*2)*.06;
    const aura=ctx.createRadialGradient(x,y-22*z,3,x,y-22*z,55*z);aura.addColorStop(0,'#ed652b4d');aura.addColorStop(1,'#b52b1300');ctx.fillStyle=aura;ctx.fillRect(x-60*z,y-80*z,120*z,120*z);
    polygon([[x-26*z,y+3*z],[x-22*z,y-47*z],[x-11*z,y-58*z],[x+10*z,y-58*z],[x+23*z,y-45*z],[x+27*z,y+3*z]],'#602c28');
    polygon([[x-23*z,y-45*z],[x,y-61*z],[x+23*z,y-45*z],[x+16*z,y-21*z],[x-16*z,y-21*z]],'#a34b31');
    polygon([[x-13*z,y-58*z],[x-27*z,y-80*z],[x-18*z,y-62*z]],'#d7774d');polygon([[x+12*z,y-58*z],[x+28*z,y-80*z],[x+18*z,y-62*z]],'#d7774d');
    ellipse(x,y-65*z,14*z,14*z,'#b76846');ellipse(x-5*z,y-67*z,3*pulse*z,2*z,'#ffe087');ellipse(x+5*z,y-67*z,3*pulse*z,2*z,'#ffe087');
    line(x+28*z,y-37*z,x+43*z,y-1*z,'#a86247',12*z);line(x+43*z,y-1*z,x+49*z,y-13*z,'#e0a05a',5*z);
  }
  if(e.elite){ctx.strokeStyle='#d6b26b';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y-17*z,17*z,25*z,0,0,Math.PI*2);ctx.stroke();}
  if(e.aggro && (e.hp<e.maxHp || e.kind==='boss')) {
    const width=e.kind==='boss'?86:36;ctx.fillStyle='#0a0a0a';ctx.fillRect(x-width/2-1,y-(e.kind==='boss'?89:45)*z,width+2,6);ctx.fillStyle=e.kind==='boss'?'#e0703f':'#b94e39';ctx.fillRect(x-width/2,y-(e.kind==='boss'?89:45)*z+1,width*e.hp/e.maxHp,4);
  }
}
function drawPlayer() {
  const p=game.player, x=sx(p.x), y=sy(p.y), z=tile/48;
  if(p.invulnerable>0 && Math.floor(game.time*16)%2===0)ctx.globalAlpha=.6;
  drawShadow(p,15*z);
  const c=CLASSES[game.classId].color;
  polygon([[x-11*z,y+2*z],[x-11*z,y-24*z],[x-6*z,y-30*z],[x+7*z,y-30*z],[x+11*z,y-23*z],[x+11*z,y+2*z]],game.classId==='mage'?'#34415a':game.classId==='ranger'?'#364536':'#55545a');
  polygon([[x-10*z,y-20*z],[x-15*z,y-24*z],[x-14*z,y-10*z],[x-7*z,y-8*z]],c);
  polygon([[x+10*z,y-20*z],[x+15*z,y-24*z],[x+14*z,y-10*z],[x+7*z,y-8*z]],c);
  if(game.classId==='knight'){
    ctx.fillStyle='#a6a49c';ctx.fillRect(x-10*z,y-27*z,20*z,8*z);ctx.fillStyle='#d8c4a0';ctx.fillRect(x-6*z,y-35*z,12*z,8*z);
    line(x+13*z,y-19*z,x+24*z,y-1*z,'#e1d5b6',4*z);line(x+19*z,y-5*z,x+29*z,y-9*z,'#9a7b53',3*z);
    polygon([[x-17*z,y-14*z],[x-23*z,y-12*z],[x-22*z,y+2*z],[x-13*z,y+1*z]],'#737e83');
  }else if(game.classId==='ranger'){
    polygon([[x-12*z,y-29*z],[x,y-40*z],[x+12*z,y-29*z],[x+7*z,y-23*z],[x-7*z,y-23*z]],'#6c7451');ellipse(x,y-28*z,5*z,5*z,'#d5b297');
    ctx.strokeStyle='#d7af70';ctx.lineWidth=3*z;ctx.beginPath();ctx.arc(x+17*z,y-12*z,15*z,-1.4,1.3);ctx.stroke();line(x+20*z,y-26*z,x+21*z,y+2*z,'#d9ccab',1*z);
  }else{
    polygon([[x-13*z,y-29*z],[x,y-43*z],[x+13*z,y-29*z]],'#536a8b');ellipse(x,y-28*z,5*z,5*z,'#d6aa91');
    line(x+16*z,y-19*z,x+21*z,y+4*z,'#8f7051',3*z);ellipse(x+16*z,y-22*z,6*z,6*z,'#f29145');
  }
  if(p.attackPulse>0){const a=Math.atan2(p.facing.y,p.facing.x);line(x+Math.cos(a)*13*z,y-18*z+Math.sin(a)*8*z,x+Math.cos(a)*25*z,y-18*z+Math.sin(a)*13*z,'#ffdfae',2*z);}
  ctx.globalAlpha=1;
}
function drawDrops() {
  for(const d of game.drops){const x=sx(d.x), y=sy(d.y)+Math.sin(game.time*3+d.x)*3;const col=d.type==='potion'?'#d85651':d.item.rarity==='rare'?'#ebc56b':'#70acd3';const g=ctx.createRadialGradient(x,y,2,x,y,24);g.addColorStop(0,col+'66');g.addColorStop(1,col+'00');ctx.fillStyle=g;ctx.fillRect(x-24,y-24,48,48);ellipse(x,y+6,7,3,'#0009');if(d.type==='potion'){ctx.fillStyle=col;ctx.fillRect(x-4,y-10,8,13);ctx.fillStyle='#e6d5ae';ctx.fillRect(x-3,y-13,6,3)}else{polygon([[x,y-14],[x+9,y-5],[x,y+5],[x-9,y-5]],col);polygon([[x,y-14],[x+9,y-5],[x,y-3],[x-9,y-5]],'#ffffff44')}}
}
function drawProjectiles(){for(const p of game.projectiles){const x=sx(p.x),y=sy(p.y);if(p.type==='arrow'){const a=Math.atan2(p.vy,p.vx);line(x-Math.cos(a)*12,y-Math.sin(a)*12,x+Math.cos(a)*5,y+Math.sin(a)*5,'#d8bd87',2);polygon([[x+Math.cos(a)*8,y+Math.sin(a)*8],[x+Math.cos(a+2.4)*6,y+Math.sin(a+2.4)*6],[x+Math.cos(a-2.4)*6,y+Math.sin(a-2.4)*6]],'#eee2b5')}else{const col=p.friendly?'#ffb65c':'#fa633b';const g=ctx.createRadialGradient(x,y,1,x,y,13);g.addColorStop(0,'#ffe5a9');g.addColorStop(.25,col);g.addColorStop(1,'#ed462000');ctx.fillStyle=g;ctx.fillRect(x-13,y-13,26,26)}}}
function drawEffects(){for(const fx of game.effects){const x=sx(fx.x),y=sy(fx.y),age=fx.age;ctx.save();ctx.globalAlpha=Math.max(0,1-age/(fx.type==='level'?1.4:.65));if(fx.type==='slash'||fx.type==='cleave'){ctx.strokeStyle=fx.type==='cleave'?'#ffb25c':'#eee1bd';ctx.lineWidth=fx.type==='cleave'?8:5;ctx.beginPath();ctx.arc(x,y-13,(fx.type==='cleave'?73:49)*Math.min(1,age*7),fx.angle-1.05,fx.angle+1.05);ctx.stroke()}else if(fx.type==='nova'||fx.type==='level'||fx.type==='potion'){const radius=(fx.type==='nova'?145:fx.type==='level'?90:38)*Math.min(1,age*4);ctx.strokeStyle=fx.type==='potion'?'#77dbaa':fx.type==='level'?'#f3d078':'#ff8c46';ctx.lineWidth=fx.type==='nova'?9:4;ctx.beginPath();ctx.arc(x,y-12,radius,0,Math.PI*2);ctx.stroke()}else{ellipse(x,y-20,19*age+5,9*age+3,fx.type==='blood'?'#ed5a50a8':'#ffa95eab')}ctx.restore()}}
function drawTexts(){ctx.textAlign='center';ctx.font='700 13px Inter, sans-serif';for(const t of game.texts){ctx.globalAlpha=1-t.age/.85;ctx.fillStyle='#090909';ctx.fillText(t.text,sx(t.x)+1,sy(t.y)+1);ctx.fillStyle=t.color;ctx.fillText(t.text,sx(t.x),sy(t.y))}ctx.globalAlpha=1}
function render() {
  ctx.fillStyle='#0b0c0d';ctx.fillRect(0,0,viewW,viewH);
  if(!game || screen==='title')return;
  camera.x=game.player.x;camera.y=game.player.y+(viewW<760?.35:0);
  const left=Math.max(0,Math.floor(camera.x-viewW/(2*tile))-1),right=Math.min(SIZE-1,Math.ceil(camera.x+viewW/(2*tile))+1);
  const top=Math.max(0,Math.floor(camera.y-viewH/(2*tile))-1),bottom=Math.min(SIZE-1,Math.ceil(camera.y+viewH/(2*tile))+1);
  for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++)if(game.map[y][x]===1)drawFloor(x,y);
  for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++)if(game.map[y][x]===0)drawWall(x,y);
  // Ambient haze follows the hero through each chamber.
  const haze=ctx.createRadialGradient(viewW/2,viewH/2,Math.min(viewW,viewH)*.12,viewW/2,viewH/2,Math.max(viewW,viewH)*.7);haze.addColorStop(0,'#00000000');haze.addColorStop(1,'#0000008a');ctx.fillStyle=haze;ctx.fillRect(0,0,viewW,viewH);
  drawDrops();
  const entities=game.enemies.filter(e=>e.hp>0&&e.x>left-1&&e.x<right+1&&e.y>top-1&&e.y<bottom+1).map(e=>({y:e.y,draw:()=>drawEnemy(e)}));
  entities.push({y:game.player.y,draw:drawPlayer});entities.sort((a,b)=>a.y-b.y);for(const e of entities)e.draw();
  drawProjectiles();drawEffects();drawTexts();
  if(game.player.hp<stats(game).hp*.26){ctx.fillStyle=`rgba(135,17,13,${.06+Math.sin(game.time*6)*.035})`;ctx.fillRect(0,0,viewW,viewH)}
}
function drawMinimap(){if(!game)return;const scale=mini.width/SIZE;mctx.clearRect(0,0,mini.width,mini.height);mctx.fillStyle='#080d0e';mctx.fillRect(0,0,mini.width,mini.height);const p=game.player;for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){if(Math.hypot(x+.5-p.x,y+.5-p.y)<5.8)discovered.add(y*SIZE+x);if(!discovered.has(y*SIZE+x))continue;mctx.fillStyle=game.map[y][x]?'#6c6554':'#222c2d';mctx.fillRect(x*scale,y*scale,Math.ceil(scale),Math.ceil(scale))}for(const e of game.enemies)if(e.hp>0&&e.kind==='boss'&&discovered.has(Math.floor(e.y)*SIZE+Math.floor(e.x))){mctx.fillStyle='#e26940';mctx.beginPath();mctx.arc(e.x*scale,e.y*scale,4,0,Math.PI*2);mctx.fill()}mctx.fillStyle='#f7d884';mctx.beginPath();mctx.arc(p.x*scale,p.y*scale,3.5,0,Math.PI*2);mctx.fill()}

function setScreen(which){screen=which;$('start-screen').classList.toggle('hidden',which!=='title');$('hud').classList.toggle('hidden',which==='title');$('end-screen').classList.toggle('hidden',which!=='end');}
function start(classId=selectedClass, seed=Date.now()) {game=createGame(classId,seed);discovered=new Set();previousEvent=null;inventoryOpen=false;$('inventory-panel').classList.add('hidden');setScreen('playing');updateHud();saveGame()}
function saveGame(){if(game&&!game.dead){try{localStorage.setItem(SAVE_KEY,serializeGame(game))}catch{}}}
function loadGame(){try{const raw=localStorage.getItem(SAVE_KEY);if(!raw)return false;const restored=restoreGame(raw);if(restored.dead)return false;game=restored;discovered=new Set();previousEvent=null;setScreen(restored.pendingFloor?'end':'playing');if(restored.pendingFloor)showEnd(true);updateHud();return true}catch{return false}}
function updateStart(){let exists=false;try{const raw=localStorage.getItem(SAVE_KEY);if(raw){const saved=JSON.parse(raw);exists=saved.version===1&&!saved.dead}}catch{}$('continue-button').classList.toggle('hidden',!exists)}
function updateHud(){if(!game)return;const p=game.player,s=stats(game),spec=CLASSES[game.classId];$('hero-name').textContent=spec.name.toUpperCase();$('hero-level').textContent=`LVL ${p.level}`;$('portrait').firstElementChild.textContent=game.classId==='knight'?'⚔':game.classId==='ranger'?'➶':'✦';$('hp-fill').style.width=`${p.hp/s.hp*100}%`;$('mana-fill').style.width=`${p.mana/s.mana*100}%`;$('hp-label').textContent=`${Math.ceil(p.hp)} / ${Math.round(s.hp)}`;$('mana-label').textContent=`${Math.ceil(p.mana)} / ${Math.round(s.mana)}`;$('xp-fill').style.width=`${p.xp/xpNeeded(p.level)*100}%`;$('gold-label').textContent=game.gold;$('kills-label').textContent=`${game.kills} slain`;$('potion-count').textContent=p.potions;$('skill-name').textContent=spec.skill;$('skill-icon').textContent=game.classId==='knight'?'⚔':game.classId==='ranger'?'➶':'✦';$('skill-cooldown').style.height=`${Math.min(100,p.skillCooldown/5.8*100)}%`;$('floor-label').textContent=`DEPTH ${roman(game.floor)}`;$('quest-title').textContent=game.pendingFloor?'The Forge Is Yours':"The Tyrant's Forge";$('quest-detail').textContent=game.pendingFloor?'Descend into deeper fire':`Find and slay Azrath · ${game.enemies.filter(e=>e.hp>0&&e.kind!=='boss').length} foes roam`;
  if(game.events.at(-1)!==previousEvent){previousEvent=game.events.at(-1);const log=$('message-log');log.replaceChildren();for(const ev of game.events.slice(-4)){const div=document.createElement('div');div.className=`log-entry ${ev.type}`;div.textContent=ev.message;log.append(div)}}
  drawMinimap();
}
function openInventory(){if(!game||screen!=='playing')return;inventoryOpen=true;$('inventory-panel').classList.remove('hidden');renderInventory();saveGame()}
function closeInventory(){inventoryOpen=false;$('inventory-panel').classList.add('hidden')}
function renderInventory(){const p=game.player,s=stats(game);$('character-summary').replaceChildren();for(const text of [`LEVEL ${p.level}`,`${Math.round(s.damage)} DAMAGE`,`${Math.round(s.armor)} ARMOR`,`${s.speed.toFixed(1)} SPEED`,`${game.gold} GOLD`]){const span=document.createElement('span');span.textContent=text;$('character-summary').append(span)}$('bag-count').textContent=`${p.inventory.length} / 18`;const gear=$('equipment-grid'),bag=$('bag-grid');gear.replaceChildren();bag.replaceChildren();for(const slot of SLOTS){const item=p.equipment[slot],b=document.createElement('button');b.className=`item-card ${item?.rarity||''}`;b.disabled=true;const small=document.createElement('small'),strong=document.createElement('strong'),desc=document.createElement('span');small.textContent=slot.toUpperCase();strong.textContent=item?.name||'Empty';desc.textContent=item?itemDescription(item):'No item equipped';b.append(small,strong,desc);gear.append(b)}for(const item of p.inventory){const b=document.createElement('button');b.className=`item-card ${item.rarity}`;const small=document.createElement('small'),strong=document.createElement('strong'),desc=document.createElement('span');small.textContent=item.slot.toUpperCase();strong.textContent=item.name;desc.textContent=itemDescription(item);b.append(small,strong,desc);b.addEventListener('click',()=>{equipItem(game,item.id);renderInventory();updateHud();saveGame()});bag.append(b)}if(!p.inventory.length){const empty=document.createElement('p');empty.className='inventory-tip';empty.textContent='The satchel is empty. Hunt monsters for enchanted gear.';bag.append(empty)}}
function showEnd(victory){setScreen('end');$('end-eyebrow').textContent=victory?'AZRATH HAS FALLEN':'THE FORGE CLAIMS YOU';$('end-title').textContent=victory?'The tyrant is slain':'You have fallen';$('end-description').textContent=victory?'The hammer falls silent, but deeper fires still burn beneath the ruins.':'Your soul lingers among the embers. Rise and reclaim your path.';$('end-stats').textContent=`LEVEL ${game.player.level} · ${game.kills} FOES SLAIN · ${game.gold} GOLD`;$('end-primary').firstChild.textContent=victory?'DESCEND DEEPER ':'RISE AGAIN ';$('end-secondary').textContent='NEW HERO';saveGame()}

document.querySelectorAll('.class-card').forEach(card=>card.addEventListener('click',()=>{selectedClass=card.dataset.class;document.querySelectorAll('.class-card').forEach(c=>c.classList.toggle('selected',c===card))}));
$('start-button').addEventListener('click',()=>start());$('continue-button').addEventListener('click',()=>{if(!loadGame())start()});
$('inventory-button').addEventListener('click',openInventory);$('close-inventory').addEventListener('click',closeInventory);
$('skill-button').addEventListener('click',()=>{if(game&&!inventoryOpen)castSkill(game,pointer.aim)});$('potion-button').addEventListener('click',()=>{if(game&&!inventoryOpen)drinkPotion(game)});
$('end-primary').addEventListener('click',()=>{if(game.pendingFloor){game=nextFloor(game);discovered=new Set();previousEvent=null;setScreen('playing');saveGame()}else{const old=game;start(old.classId,Date.now());game.player.level=old.player.level;game.player.xp=old.player.xp;game.player.inventory=old.player.inventory;game.player.equipment=old.player.equipment;game.player.potions=Math.max(3,old.player.potions);game.gold=Math.floor(old.gold*.8);const s=stats(game);game.player.hp=s.hp;game.player.mana=s.mana;saveGame()}updateHud()});
$('end-secondary').addEventListener('click',()=>{game=null;try{localStorage.removeItem(SAVE_KEY)}catch{}setScreen('title');updateStart()});
window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();keys.add(k);if(e.repeat)return;if(k==='escape'&&inventoryOpen)closeInventory();else if(k==='i'){inventoryOpen?closeInventory():openInventory()}else if(screen==='playing'&&!inventoryOpen){if(k==='1'||k==='q')castSkill(game,pointer.aim);if(k===' ')drinkPotion(game)}});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>{keys.clear();pointer.down=false;pointer.attackId=null;pointer.joyX=0;pointer.joyY=0;resetJoystick()});
canvas.addEventListener('pointermove',e=>{pointer.aim=worldAt(e.clientX,e.clientY)});
canvas.addEventListener('pointerdown',e=>{if(screen!=='playing'||inventoryOpen)return;pointer.aim=worldAt(e.clientX,e.clientY);pointer.down=true;canvas.setPointerCapture(e.pointerId);attack(game,pointer.aim)});
canvas.addEventListener('pointerup',()=>pointer.down=false);canvas.addEventListener('pointercancel',()=>pointer.down=false);
canvas.addEventListener('contextmenu',e=>e.preventDefault());
const joystick=$('joystick');
function resetJoystick(){joystick.querySelector('#joystick-knob').style.transform='translate(0,0)'}
function moveJoystick(e){const rect=joystick.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2,dx=e.clientX-cx,dy=e.clientY-cy,mag=Math.hypot(dx,dy),limit=37;pointer.joyX=mag>6?dx/Math.max(mag,limit):0;pointer.joyY=mag>6?dy/Math.max(mag,limit):0;joystick.querySelector('#joystick-knob').style.transform=`translate(${Math.max(-limit,Math.min(limit,dx))}px,${Math.max(-limit,Math.min(limit,dy))}px)`}
joystick.addEventListener('pointerdown',e=>{e.preventDefault();pointer.joystickId=e.pointerId;joystick.setPointerCapture(e.pointerId);moveJoystick(e)});joystick.addEventListener('pointermove',e=>{if(pointer.joystickId===e.pointerId)moveJoystick(e)});function stopJoy(e){if(pointer.joystickId!==e.pointerId)return;pointer.joystickId=null;pointer.joyX=pointer.joyY=0;resetJoystick()}joystick.addEventListener('pointerup',stopJoy);joystick.addEventListener('pointercancel',stopJoy);
const mobileAttack=$('mobile-attack');mobileAttack.addEventListener('pointerdown',e=>{e.preventDefault();pointer.attackId=e.pointerId;mobileAttack.setPointerCapture(e.pointerId);if(game)attack(game,pointer.aim)});mobileAttack.addEventListener('pointerup',()=>pointer.attackId=null);mobileAttack.addEventListener('pointercancel',()=>pointer.attackId=null);
$('mobile-skill').addEventListener('pointerdown',e=>{e.preventDefault();if(game)castSkill(game,pointer.aim)});$('mobile-potion').addEventListener('pointerdown',e=>{e.preventDefault();if(game)drinkPotion(game)});

function frame(now){const dt=Math.min(.05,(now-lastFrame)/1000);lastFrame=now;if(game&&screen==='playing'&&!inventoryOpen){const input={moveX:(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0)+pointer.joyX,moveY:(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0)+pointer.joyY,attacking:pointer.down||pointer.attackId!==null,aim:pointer.aim};tick(game,input,dt);saveClock+=dt;if(saveClock>8){saveClock=0;saveGame()}if(game.dead)showEnd(false);else if(game.won&&game.pendingFloor)showEnd(true)}render();if(now-lastHud>110){lastHud=now;if(game&&screen!=='title')updateHud()}requestAnimationFrame(frame)}
updateStart();requestAnimationFrame(frame);
