import { WORLD, UNIT, COST, createGame, tick, train, canTrain, supplyUsed, entityAt, select, selectedUnits, command, stop } from './game.js';

const $ = id => document.getElementById(id);
const canvas = $('gameCanvas'), ctx = canvas.getContext('2d');
const minimap = $('minimap'), mini = minimap.getContext('2d');
let game = createGame(), camera = {x: 560, y: 500, zoom: 1}, attackMode = false, paused = false;
let width = 0, height = 0, scale = 1, drag = null, pointers = new Map(), lastFrame = performance.now();
const stars = Array.from({length: 180}, (_,i) => ({x:(i*9973%1597), y:(i*7433%997), r:i%7===0?1.5:.7, a:.17+(i%5)*.07}));
const debris = Array.from({length: 38}, (_,i) => ({x:(i*731%1550)+25,y:(i*431%950)+25,r:4+i%9,rot:i*.74}));
const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
function resize() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  width = canvas.clientWidth; height = canvas.clientHeight;
  canvas.width = Math.round(width*dpr); canvas.height = Math.round(height*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  minimap.width = Math.round(minimap.clientWidth*dpr); minimap.height = Math.round(minimap.clientHeight*dpr);
  mini.setTransform(dpr,0,0,dpr,0,0);
  scale = Math.max(width/1000,height/750)*camera.zoom;
  clampCamera();
}
function clampCamera() {
  const halfW = width / scale / 2, halfH = height / scale / 2;
  camera.x = halfW >= WORLD.width/2 ? WORLD.width/2 : clamp(camera.x,halfW,WORLD.width-halfW);
  camera.y = halfH >= WORLD.height/2 ? WORLD.height/2 : clamp(camera.y,halfH,WORLD.height-halfH);
}
function worldToScreen(x,y){return {x:(x-camera.x)*scale+width/2,y:(y-camera.y)*scale+height/2};}
function screenToWorld(x,y){return {x:(x-width/2)/scale+camera.x,y:(y-height/2)/scale+camera.y};}
function line(x1,y1,x2,y2,color,w=1){ctx.strokeStyle=color;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
function circle(x,y,r,fill,stroke=null,sw=1){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=sw;ctx.stroke();}}
function polygon(points,fill,stroke=null,sw=1){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=sw;ctx.stroke();}}
function renderTerrain() {
  ctx.fillStyle='#0b1b2b';ctx.fillRect(0,0,width,height);
  ctx.save();ctx.translate(width/2-camera.x*scale,height/2-camera.y*scale);ctx.scale(scale,scale);
  const bg=ctx.createRadialGradient(770,500,80,770,500,900);bg.addColorStop(0,'#173247');bg.addColorStop(.55,'#0d2232');bg.addColorStop(1,'#091723');ctx.fillStyle=bg;ctx.fillRect(0,0,WORLD.width,WORLD.height);
  ctx.strokeStyle='#36506437';ctx.lineWidth=1;
  for(let x=0;x<=WORLD.width;x+=50){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,WORLD.height);ctx.stroke();}
  for(let y=0;y<=WORLD.height;y+=50){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(WORLD.width,y);ctx.stroke();}
  ctx.strokeStyle='#55809627';ctx.lineWidth=1.5;
  for(let x=0;x<=WORLD.width;x+=250){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,WORLD.height);ctx.stroke();}
  for(let y=0;y<=WORLD.height;y+=250){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(WORLD.width,y);ctx.stroke();}
  for(const s of stars) circle(s.x,s.y,s.r,`rgba(157,206,220,${s.a})`);
  for(const d of debris){ctx.save();ctx.translate(d.x,d.y);ctx.rotate(d.rot);polygon([[-d.r,-d.r*.3],[-d.r*.3,-d.r*.8],[d.r*.8,-d.r*.5],[d.r,d.r*.25],[d.r*.2,d.r*.7]],'#29405088','#48607455');ctx.restore();}
  ctx.strokeStyle='#72aac34a';ctx.lineWidth=3;ctx.strokeRect(5,5,WORLD.width-10,WORLD.height-10);
  ctx.restore();
  // Restrained sector labels stay behind units.
  const p=worldToScreen(780,122);ctx.fillStyle='#72a5b641';ctx.font='700 18px Rajdhani, sans-serif';ctx.letterSpacing='3px';ctx.fillText('THE ASHEN REACH',p.x,p.y);
}
function drawCrystal(c,t) {
  if(c.amount<=0) return;const p=worldToScreen(c.x,c.y),r=c.radius*scale;
  if(p.x<-60||p.x>width+60||p.y<-60||p.y>height+60)return;
  const pulse=1+Math.sin(t*2+c.id)*.06;
  const glow=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,r*2.7);glow.addColorStop(0,'#6df7f177');glow.addColorStop(1,'#42c8e600');circle(p.x,p.y,r*2.7,glow);
  for(let i=0;i<4;i++){let a=i*Math.PI/2+.6;let x=p.x+Math.cos(a)*r*.52,y=p.y+Math.sin(a)*r*.42;polygon([[x,y-r*.8*pulse],[x+r*.42,y],[x,y+r*.8*pulse],[x-r*.42,y]],i%2?'#3bb7d0':'#82f5ed','#b1fffa',1);}
  polygon([[p.x,p.y-r*1.25*pulse],[p.x+r*.6,p.y],[p.x,p.y+r*1.1*pulse],[p.x-r*.6,p.y]],'#60dfe2','#c4fffb',1.5);
  if(game.selected.some(id=>game.units.find(u=>u.id===id&&u.type==='worker')))circle(p.x,p.y,r+10,'#0000','#8fece877',1);
}
function drawBase(b,t) {
  if(b.hp<=0)return;const p=worldToScreen(b.x,b.y),r=b.radius*scale;const friendly=b.side==='player';
  const main=friendly?'#54d3dc':'#eb785f',dim=friendly?'#204b60':'#633c3e';
  const halo=ctx.createRadialGradient(p.x,p.y,r*.3,p.x,p.y,r*1.85);halo.addColorStop(0,friendly?'#5ceaf328':'#eb73582b');halo.addColorStop(1,'#0000');circle(p.x,p.y,r*1.85,halo);
  ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.PI/4);ctx.fillStyle='#102332';ctx.strokeStyle=main;ctx.lineWidth=3;ctx.fillRect(-r*.82,-r*.82,r*1.64,r*1.64);ctx.strokeRect(-r*.82,-r*.82,r*1.64,r*1.64);ctx.strokeStyle='#7eafaf88';ctx.lineWidth=1.5;ctx.strokeRect(-r*.61,-r*.61,r*1.22,r*1.22);ctx.restore();
  circle(p.x,p.y,r*.68,dim,main,2);circle(p.x,p.y,r*.42,'#0b1a28',main,2);
  const core=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,r*.4);core.addColorStop(0,friendly?'#a7ffff':'#ffbb89');core.addColorStop(1,friendly?'#2aafc5':'#d75649');circle(p.x,p.y,r*.4,core);
  for(let i=0;i<4;i++){let a=i*Math.PI/2+t*.2;line(p.x+Math.cos(a)*r*.75,p.y+Math.sin(a)*r*.75,p.x+Math.cos(a)*r*1.05,p.y+Math.sin(a)*r*1.05,main,3);}
  if(game.selected.includes(b.id))circle(p.x,p.y,r*1.25,'#0000','#a1f9e5',2);
  drawHealth(p.x,p.y-r-17,r*1.5,b.hp/b.maxHp,friendly);
  ctx.fillStyle=friendly?'#b8f0eb':'#ffb4a5';ctx.font='700 11px Rajdhani, sans-serif';ctx.textAlign='center';ctx.fillText(friendly?'FRONTIER FORGE':'HOSTILE FORGE',p.x,p.y+r+24);ctx.textAlign='left';
}
function drawHealth(x,y,w,friendlyRatio,friendly){ctx.fillStyle='#07131ccc';ctx.fillRect(x-w/2,y,w,5);ctx.fillStyle=friendly?'#75e8c8':'#f07d64';ctx.fillRect(x-w/2,y,w*clamp(friendlyRatio,0,1),5);}
function drawUnit(u,t) {
  const p=worldToScreen(u.x,u.y),r=u.radius*scale;if(p.x<-50||p.x>width+50||p.y<-50||p.y>height+50)return;
  const friendly=u.side==='player', color=friendly?'#7de6e2':'#ed826c', dark=friendly?'#245b67':'#704745';
  if(game.selected.includes(u.id)){circle(p.x,p.y,r+9,'#0000','#85f6e4',2);circle(p.x,p.y,r+13,'#0000','#85f6e43b',1);}
  circle(p.x,p.y+r*.5,r*.9,'#02091177');
  ctx.save();ctx.translate(p.x,p.y);ctx.rotate(u.target?Math.atan2(u.target.y-u.y,u.target.x-u.x)+Math.PI/2:0);
  if(u.type==='worker'){
    polygon([[0,-r*.9],[r*.8,-r*.12],[r*.53,r*.78],[0,r*.42],[-r*.53,r*.78],[-r*.8,-r*.12]],dark,color,2);
    circle(0,0,r*.3,u.carrying?'#8efff4':'#a2e3e2');
    if(u.carrying)circle(0,-r*.25,r*.2,'#c1fffa');
  }else if(u.type==='soldier'){
    polygon([[0,-r],[r*.8,-r*.3],[r*.78,r*.7],[0,r*.45],[-r*.78,r*.7],[-r*.8,-r*.3]],dark,color,2);
    polygon([[0,-r*.75],[r*.35,r*.1],[0,r*.3],[-r*.35,r*.1]],color);
    line(-r*.8,r*.2,-r*1.1,-r*.6,color,2);line(r*.8,r*.2,r*1.1,-r*.6,color,2);
  }else{
    polygon([[0,-r],[r*.9,-r*.65],[r,r*.55],[r*.45,r*.95],[-r*.45,r*.95],[-r,r*.55],[-r*.9,-r*.65]],dark,color,3);
    circle(0,0,r*.47,'#0d2633',color,2);circle(0,0,r*.21,color);line(0,-r*.4,0,-r*1.3,color,4);
  }ctx.restore();
  if(u.hp<u.maxHp || game.selected.includes(u.id))drawHealth(p.x,p.y-r-10,r*2,u.hp/u.maxHp,friendly);
}
function renderEffects(){for(const s of game.shots){const a=s.life/s.maxLife;const p=worldToScreen(s.x,s.y),q=worldToScreen(s.tx,s.ty);line(p.x,p.y,q.x,q.y,s.side==='player'?`rgba(128,246,234,${a})`:`rgba(255,132,103,${a})`,s.heavy?5:2);circle(q.x,q.y,s.heavy?5:3,s.side==='player'?`rgba(201,255,242,${a})`:`rgba(255,197,128,${a})`);}for(const s of game.sparks){const p=worldToScreen(s.x,s.y),a=s.life/.45;circle(p.x,p.y,(1-a)*22,'#0000',s.side==='flux'?`rgba(110,249,246,${a})`:s.side==='player'?`rgba(129,255,216,${a})`:`rgba(255,137,113,${a})`,2);}}
function renderDrag(){if(!drag||!drag.moved||pointers.size>1)return;const x=Math.min(drag.sx,drag.x),y=Math.min(drag.sy,drag.y),w=Math.abs(drag.x-drag.sx),h=Math.abs(drag.y-drag.sy);ctx.fillStyle='#78e8df25';ctx.fillRect(x,y,w,h);ctx.strokeStyle='#9efaf0';ctx.lineWidth=1;ctx.strokeRect(x,y,w,h);}
function renderMinimap(){const w=minimap.clientWidth,h=minimap.clientHeight;mini.clearRect(0,0,w,h);mini.fillStyle='#091824';mini.fillRect(0,0,w,h);mini.strokeStyle='#27465b';for(let x=0;x<w;x+=w/8){mini.beginPath();mini.moveTo(x,0);mini.lineTo(x,h);mini.stroke();}for(let y=0;y<h;y+=h/5){mini.beginPath();mini.moveTo(0,y);mini.lineTo(w,y);mini.stroke();}const pos=e=>({x:e.x/WORLD.width*w,y:e.y/WORLD.height*h});for(const c of game.crystals){if(c.amount<=0)continue;let p=pos(c);mini.fillStyle='#65dbe0';mini.fillRect(p.x-1,p.y-1,3,3);}for(const b of game.bases){if(b.hp<=0)continue;let p=pos(b);mini.fillStyle=b.side==='player'?'#7df4dc':'#f2816e';mini.fillRect(p.x-4,p.y-4,8,8);}for(const u of game.units){let p=pos(u);mini.fillStyle=u.side==='player'?'#a1f9e7':'#ff8a75';mini.fillRect(p.x-1,p.y-1,2,2);}mini.strokeStyle='#c4f9f1';mini.lineWidth=1;mini.strokeRect((camera.x-width/2/scale)/WORLD.width*w,(camera.y-height/2/scale)/WORLD.height*h,width/scale/WORLD.width*w,height/scale/WORLD.height*h);}
function render(t){renderTerrain();game.crystals.forEach(c=>drawCrystal(c,t));game.bases.forEach(b=>drawBase(b,t));game.units.forEach(u=>drawUnit(u,t));renderEffects();renderDrag();renderMinimap();}
function updateUI(){
  $('flux').textContent=Math.floor(game.flux);$('supply').textContent=`${supplyUsed(game)}/${game.supplyCap}`;
  for(const [type,id] of [['worker','trainWorker'],['soldier','trainSoldier'],['tank','trainTank']]){$(id).disabled=!canTrain(game,type);$(id).title=game.flux<COST[type]?'Need more flux':supplyUsed(game)+UNIT[type].supply>game.supplyCap?'Supply cap reached':'';}
  const queue=game.queue[0];$('queueLabel').textContent=queue?`${game.queue.length} QUEUED · ${Math.ceil(queue.remaining)}s`:'';
  const entities=[...game.units,...game.bases].filter(e=>game.selected.includes(e.id));let entity=entities[0];
  if(entities.length>1){$('selectionName').textContent=`${entities.length} units selected`;$('selectionMeta').textContent=`${entities.filter(e=>e.type==='worker').length} drones · ${entities.filter(e=>e.type!=='worker').length} combat`;$('selectionIcon').textContent='◎';$('healthFill').style.width=`${entities.reduce((a,e)=>a+e.hp/e.maxHp,0)/entities.length*100}%`;}
  else if(entity){$('selectionName').textContent=entity.name||UNIT[entity.type].name;$('selectionMeta').textContent=entity.type==='worker'?entity.task==='harvest'?'Harvesting flux':'Resource gatherer':entity.type?`HP ${Math.ceil(entity.hp)} / ${entity.maxHp}`:'Production headquarters';$('selectionIcon').textContent=entity.type==='worker'?'◇':entity.type==='soldier'?'✣':entity.type==='tank'?'⬡':'✦';$('healthFill').style.width=`${entity.hp/entity.maxHp*100}%`;}
  else{$('selectionName').textContent='Frontier Outpost';$('selectionMeta').textContent='Select your units to issue orders';$('selectionIcon').textContent='✦';$('healthFill').style.width='100%';}
  $('gameTime').textContent=`${String(Math.floor(game.time/60)).padStart(2,'0')}:${String(Math.floor(game.time%60)).padStart(2,'0')}`;
  $('intelText').textContent=game.time<game.messageUntil?game.message:'Tap an enemy to focus fire. Use attack move to advance while engaging threats.';
  $('modePill').hidden=!attackMode;$('attackMove').classList.toggle('active',attackMode);
  if(game.status!=='playing'&&!$('overlay').dataset.finished){$('overlay').dataset.finished='1';showDialog(game.status==='victory'?'SECTOR SECURED':'FORGE LOST',game.status==='victory'?'The Ashen Reach is yours.':'Your frontier forge has fallen.',game.status==='victory'?'Your fleet destroyed the hostile forge. Ready for another command?':'Regroup, gather flux early, and defend your forge.', 'PLAY AGAIN', true);}
}
function showDialog(kicker,title,body,button,finished=false){$('dialogKicker').textContent=kicker;$('dialogTitle').textContent=title;$('dialogText').textContent=body;$('dialogButton').textContent=button;$('dialogTips').innerHTML=finished?'':'<ul><li>Tap a unit, then tap terrain to move it.</li><li>Send drones to glowing crystals to gather flux.</li><li>Train combat units and destroy the hostile forge.</li><li>Drag to select several units. Two-finger drag pans the field.</li></ul>';$('overlay').hidden=false;paused=true;}
function closeDialog(){if($('overlay').dataset.finished){game=createGame();camera={x:560,y:500,zoom:1};delete $('overlay').dataset.finished;resize();} $('overlay').hidden=true;paused=false;lastFrame=performance.now();}
function showHint(text){game.message=text;game.messageUntil=game.time+4;$('hint').textContent=text;clearTimeout(showHint.timer);showHint.timer=setTimeout(()=>$('hint').textContent='Tap a unit to select · drag to select several',4500);}
function issueAt(world){const target=entityAt(game,world.x,world.y);if(target?.side==='player'){select(game,[target.id]);return;}if(game.selected.length){if(command(game,world.x,world.y,target,attackMode)){attackMode=false;showHint(target?.amount!==undefined?'Drones gathering flux':target?.side==='enemy'?'Focus fire ordered':'Order confirmed');}}else if(target?.side==='enemy')showHint('Select your units first');}
function pointerPosition(e){const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
canvas.addEventListener('pointerdown',e=>{if(paused)return;canvas.setPointerCapture(e.pointerId);const p=pointerPosition(e);pointers.set(e.pointerId,p);if(pointers.size===1)drag={sx:p.x,sy:p.y,x:p.x,y:p.y,moved:false,button:e.button};else drag=null;});
canvas.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;const p=pointerPosition(e),old=pointers.get(e.pointerId);pointers.set(e.pointerId,p);if(pointers.size>=2){camera.x-=(p.x-old.x)/scale;camera.y-=(p.y-old.y)/scale;clampCamera();drag=null;}else if(drag){drag.x=p.x;drag.y=p.y;drag.moved=Math.hypot(p.x-drag.sx,p.y-drag.sy)>10;}});
canvas.addEventListener('pointerup',e=>{const p=pointerPosition(e);pointers.delete(e.pointerId);if(!drag)return;const d=drag;drag=null;if(d.moved){const a=screenToWorld(Math.min(d.sx,p.x),Math.min(d.sy,p.y)),b=screenToWorld(Math.max(d.sx,p.x),Math.max(d.sy,p.y));select(game,game.units.filter(u=>u.side==='player'&&u.x>=a.x&&u.x<=b.x&&u.y>=a.y&&u.y<=b.y).map(u=>u.id));showHint(game.selected.length?`${game.selected.length} units selected`:'No units in selection');}else{const world=screenToWorld(p.x,p.y);if(d.button===2){command(game,world.x,world.y,entityAt(game,world.x,world.y),attackMode);attackMode=false;}else issueAt(world);}});
canvas.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);drag=null;});canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('wheel',e=>{e.preventDefault();camera.zoom=clamp(camera.zoom*(e.deltaY<0?1.1:.9),.65,1.75);resize();},{passive:false});
minimap.addEventListener('pointerdown',e=>{const r=minimap.getBoundingClientRect();camera.x=clamp((e.clientX-r.left)/r.width*WORLD.width,0,WORLD.width);camera.y=clamp((e.clientY-r.top)/r.height*WORLD.height,0,WORLD.height);clampCamera();});
for(const [type,id] of [['worker','trainWorker'],['soldier','trainSoldier'],['tank','trainTank']])$(id).addEventListener('click',()=>{if(train(game,type))showHint(`${UNIT[type].name} added to queue`);else showHint('Insufficient flux or supply');});
$('attackMove').addEventListener('click',()=>{attackMode=!attackMode;showHint(attackMode?'Tap a destination to attack move':'Attack move cancelled');});$('stop').addEventListener('click',()=>{stop(game);showHint('Selected units stopped');});$('selectArmy').addEventListener('click',()=>{select(game,game.units.filter(u=>u.side==='player'&&u.type!=='worker').map(u=>u.id));showHint(`${game.selected.length} combat units selected`);});
$('zoomIn').addEventListener('click',()=>{camera.zoom=clamp(camera.zoom*1.2,.65,1.75);resize();});$('zoomOut').addEventListener('click',()=>{camera.zoom=clamp(camera.zoom/1.2,.65,1.75);resize();});
$('helpBtn').addEventListener('click',()=>showDialog('FIELD MANUAL','Command the frontier','Mine flux, train a fleet, and destroy the hostile forge.','BACK TO BATTLE'));
$('pauseBtn').addEventListener('click',()=>{if(paused&&!$('overlay').hidden)closeDialog();else showDialog('SYSTEM PAUSED','Battle suspended','Take a moment to plan your next move.','RESUME BATTLE');});$('dialogButton').addEventListener('click',closeDialog);
window.addEventListener('keydown',e=>{if(e.key==='Escape'){attackMode=false;if(!$('overlay').hidden)closeDialog();return;}if(paused)return;const k=e.key.toLowerCase();if(k==='a'){$('attackMove').click();}else if(k==='s'){$('stop').click();}else if(k==='1'){$('selectArmy').click();}else if(k==='w'){$('trainWorker').click();}else if(k==='v'){$('trainSoldier').click();}else if(k==='b'){$('trainTank').click();}});
window.addEventListener('resize',resize);resize();
function frame(now){let dt=(now-lastFrame)/1000;lastFrame=now;if(!paused)tick(game,dt);render(now/1000);updateUI();requestAnimationFrame(frame);}requestAnimationFrame(frame);
