import { PROTOCOL,TICK,movementStep } from './shared/movement.js';
const $=id=>document.getElementById(id);
const local=['localhost','127.0.0.1'].includes(location.hostname);
const endpoint=local?location.origin:(document.querySelector('meta[name="omr-server-url"]')?.content.trim()||location.origin);
const palette={moss:['#17281d','#465940','#c3d695'],crystal:['#142338','#587998','#95e5ff'],sunken:['#112b34','#456b72','#87d8d3'],forge:['#311c19','#7f5142','#ffad72'],gardens:['#202d17','#5a7041','#c4e49a']};
const colors={moss:'#cce6a2',ember:'#ee9b6b',frost:'#8fc9e8',void:'#bb9be5',gold:'#e4c36f',creator:'#ec719c'};
let socket,room,map,selfId,active=false,seq=0,pending=[],predicted,states=[],keys=new Set(),mouse={x:0,y:0,down:false},dash=false,light=false,stick={x:0,y:0},acc=0,last=performance.now(),latency=0,mode='dungeon',generation=0,inventorySignature='',partySignature='';
const canvas=$('game'),ctx=canvas.getContext('2d');let view={x:0,y:0,scale:1,w:800,h:600};
window.OMRNetwork={get active(){return active;},get state(){return room;},get predicted(){return predicted;},open:openLobby,publish:async map=>{await connect();const published=await rpc('maps:publish',map);openLobby('dungeon',false,published.id);}};
const text=(parent,tag,value)=>{const n=document.createElement(tag);n.textContent=value;parent.append(n);return n;};
const button=(parent,label,fn)=>{const b=text(parent,'button',label);b.className='subtle';b.onclick=fn;return b;};
function show(title){const d=$('frontModal'),b=$('frontBody');b.replaceChildren();text(b,'h2',title);if(!d.open)d.showModal();return b;}
function error(message){$('serverStatus').textContent=message;const t=$('toast');t.textContent=message;t.classList.remove('hidden');setTimeout(()=>t.classList.add('hidden'),6000);}
function rpc(event,payload={}){return new Promise((resolve,reject)=>socket.timeout(5000).emit(event,payload,(err,result)=>err?reject(Error('Server did not respond. Check the deployed version.')):!result?.ok?reject(Error(result?.error||'Request failed')):resolve(result)));}
async function connect(){
  if(socket?.connected)return;
  socket?.disconnect();socket=window.io(endpoint,{reconnection:false,timeout:5000});
  socket.on('room:state',receive);
  socket.on('latency:probe',ack=>ack());
  socket.on('server:hello',h=>{if(h.protocol!==PROTOCOL){error('Server update required: deploy v1.2.6 before playing.');socket.disconnect();}});
  socket.on('disconnect',()=>{if(active){keys.clear();mouse.down=false;pending=[];active=false;error('Connection lost. Rejoin your party from Play.');}});
  await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',()=>reject(Error('Cannot reach the game server.')));});
}
function openLobby(nextMode='dungeon',quick=false,mapId){
  if(active)return;mode=nextMode;const b=show(quick?'Quickplay':'Gather your party');
  const modes=text(b,'div','');for(const value of ['dungeon','waves','duel'])button(modes,value.toUpperCase(),()=>openLobby(value,quick));
  text(b,'p',mode==='duel'?'2-4 players. Last survivor wins; fourteen arenas rotate.':mode==='waves'?'1-8 players. Survive five waves, collect rewards, then enter a new arena.':'1-8 players. Share enemies, loot, keys, and three branching stages.');
  const label=text(b,'label','NAME'),name=document.createElement('input');name.value='Wanderer';name.maxLength=20;label.append(name);
  const codeLabel=text(b,'label','ROOM CODE'),code=document.createElement('input');code.maxLength=5;codeLabel.append(code);
  const biomeLabel=text(b,'label','DUNGEON THEME'),biome=document.createElement('select');for(const [id,title]of Object.entries({moss:'The Mosskeep',crystal:'Crystal Caverns',sunken:'Sunken Ruins',forge:'Infernal Forge',gardens:'Forgotten Gardens',custom:'Selected workshop map'})){const o=text(biome,'option',title);o.value=id;}biomeLabel.append(biome);biomeLabel.hidden=mode!=='dungeon';
  const join=async solo=>{try{
    await connect();const joined=await rpc('room:join',{protocol:PROTOCOL,mode,name:name.value,code:solo?undefined:code.value.trim().toUpperCase()||undefined,quickplay:quick,skin:window.OMRV11?.meta.skin,weapon:$('weapon').value,perk:$('perk').value,biome:biome.value==='custom'?'moss':biome.value});
    selfId=joined.playerId;room=joined.room;receive(room);if(room.status==='playing')return;
    const lobby=show('ROOM '+joined.code),copy=text(lobby,'p',quick?'Waiting for another player. Quickplay starts automatically at 2 players.':mode==='duel'?'Waiting for at least two players.':'Share this code with your friends. Start now to play solo.');
    copy.id='networkLobbyCopy';
    const roster=text(lobby,'div','');roster.id='networkRoster';
    if(room.hostId===selfId&&!quick){const start=button(lobby,'Start solo',async()=>{try{copy.textContent=Object.keys(room.players).length===1?'Starting a solo run...':'Starting the party run...';const map=biome.value==='custom'?window.OMR.selectedMap():undefined;await rpc('room:start',{map,mapId});}catch(e){error(e.message);}});start.id='networkStart';}
    button(lobby,'Leave',leave);renderRoster();
    if(solo&&mode!=='duel')await rpc('room:start',{map:biome.value==='custom'?window.OMR.selectedMap():undefined,mapId});
  }catch(e){error(e.message);}};
  button(b,quick?'Find a game':'Create / join room',()=>join(false));
  if(!quick&&mode!=='duel')button(b,'Play solo',()=>join(true));
  if(mode==='dungeon')button(b,'Browse published dungeons',async()=>{try{await connect();const r=await new Promise(resolve=>socket.emit('maps:list',resolve));const list=show('Published dungeons');if(!r.maps.length)text(list,'p','No published maps yet. Build one in the workshop.');for(const m of r.maps)button(list,m.name,()=>openLobby('dungeon',false,m.id));}catch(e){error(e.message);}});
}
function renderRoster(){const r=$('networkRoster');if(r&&room){r.replaceChildren();for(const p of Object.values(room.players))text(r,'p',p.name+(p.id===room.hostId?' / host':''));const count=Object.keys(room.players).length,start=$('networkStart');if(start)start.textContent=count===1?'Start solo':'Start run';}}
function receive(s){
  if(s.protocol!==PROTOCOL){error('Client/server version mismatch. Reload after the server deploys.');return;}
  const changed=!room||s.revision!==room.revision;
  room=s;renderRoster();if(!selfId||!s.world)return;
  if(s.world.map)map=s.world.map;
  if(map&&s.world.features)map.features=s.world.features;
  if(!map){socket.emit('room:sync',r=>r?.room&&receive(r.room));return;}
  const self=s.players[selfId];if(!self)return;
  if(changed){seq=0;pending=[];states=[];generation++;}
  pending=pending.filter(i=>i.seq>self.lastSeq&&i.revision===s.revision);
  predicted={...self};
  for(const i of pending)movementStep(predicted,i,map.grid,s.world.doors,TICK,slowAt(predicted));
  states.push({at:performance.now(),room:s});if(states.length>10)states.shift();
  if(!active&&s.status==='playing'){
    active=true;window.OMRV11?.enterGame();$('preview').classList.add('hidden');$('result').classList.add('hidden');$('hud').classList.remove('hidden');$('touchControls').classList.toggle('hidden',!matchMedia('(pointer:coarse)').matches);document.body.classList.add('playing');$('leave').disabled=false;
    $('roomCode').textContent='ROOM '+s.code;$('roomCode').classList.remove('hidden');
  }
  $('pause').disabled=Object.keys(s.players).length>1;$('pause').textContent=Object.keys(s.players).length>1?'World stays live':s.paused?'Resume':'Pause';
  if(s.status==='results'){$('result').classList.remove('hidden');$('resultTitle').textContent=s.world.message;$('resultText').textContent='Your saved loadouts and blueprints are safe.';}
  hud();
}
function slowAt(p){let slow=p.statuses.ice?.55:1;for(const f of map.features)if(Math.hypot(f.x-p.x,f.y-p.y)<45){if(f.kind==='water')slow*=.65;if(f.kind==='roots')slow*=.7;}return slow;}
function input(){
  const blocked=document.querySelector('dialog[open]')||document.hidden||!document.hasFocus()||room.paused||predicted.downed||room.world.transition>0||room.status!=='playing';
  const x=blocked?0:(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0)+stick.x,y=blocked?0:(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0)+stick.y;
  let aimX=mouse.x/view.scale+view.x,aimY=mouse.y/view.scale+view.y,fire=!blocked&&mouse.down;
  if(matchMedia('(pointer:coarse)').matches){const targets=mode==='duel'?Object.values(room.players).filter(p=>p.id!==selfId&&!p.downed):room.world.enemies;const target=targets.sort((a,b)=>Math.hypot(a.x-predicted.x,a.y-predicted.y)-Math.hypot(b.x-predicted.x,b.y-predicted.y))[0];if(target){aimX=target.x;aimY=target.y;fire=!blocked;}}
  const i={seq:++seq,revision:room.revision,x,y,aimX,aimY,fire,dash:!blocked&&dash,light:!blocked&&light};dash=false;light=false;
  if(pending.length>=12)return;pending.push(i);socket.emit('player:input',i);
  if(!blocked)movementStep(predicted,i,map.grid,room.world.doors,TICK,slowAt(predicted));
}
async function act(type,extra={}){try{await rpc('player:action',{type,...extra});}catch(e){error(e.message);}}
function hud(){
  if(!room?.world||!predicted)return;const p=room.players[selfId],w=room.world;
  $('arenaName').textContent=map.name;$('phase').textContent=room.mode==='waves'?'WAVE '+w.wave:room.mode==='duel'?'ROUND '+room.round:'STAGE '+room.stage+' / BOSSES '+w.bossesRemaining;
  $('healthText').textContent=Math.ceil(p.hp)+' / '+p.maxHp+(p.downed?' / DOWNED':'');$('healthBar').style.width=p.hp/p.maxHp*100+'%';
  $('gold').textContent=p.gold;$('kills').textContent=w.kills;$('stageText').textContent=room.mode==='waves'?'Wave '+w.wave:room.mode==='duel'?'Round '+room.round:room.stage+' / '+room.maxStages;
  $('runClock').textContent=Math.floor(w.time/60)+':'+String(Math.floor(w.time%60)).padStart(2,'0');
  const keyText=Object.entries(p.keyring||{}).filter(([,n])=>n).map(([type,n])=>type[0].toUpperCase()+type.slice(1)+' '+n).join(', ')||'no keys';
  $('lanternText').textContent=Math.floor(p.lantern)+'% light / '+keyText+' / '+p.potions+' potions';$('lanternBar').style.width=p.lantern+'%';
  $('chestCost').textContent=(map.chestPricing.baseCost+map.chestPricing.increase*w.chestsOpened)+' gold';
  $('chestCostNote').textContent='+'+map.chestPricing.increase+' after each opening';
  $('worldMessage').textContent=w.message;$('worldMessage').classList.toggle('hidden',!w.message);
  const inv=$('inventory'),nextInventorySignature=JSON.stringify([p.items,p.upgrades,p.choices]);
  if(nextInventorySignature!==inventorySignature){inventorySignature=nextInventorySignature;inv.replaceChildren();for(const [id,n]of Object.entries({...p.items,...p.upgrades}))text(inv,'p',id+' x'+n);
    if(p.choices.length){text(inv,'p','Choose a relic:');for(const id of p.choices)button(inv,id,()=>act('relic',{id}));}}
  $('relicCount').textContent=Object.values(p.items).reduce((a,b)=>a+b,0);
  let party=$('partyPanel');if(!party){party=document.createElement('div');party.id='partyPanel';$('synergy').before(party);}
  const nextPartySignature=JSON.stringify([Math.round(latency/25),w.bossesRemaining,Object.values(room.players).map(peer=>[peer.id,peer.name,Math.ceil(peer.hp),peer.score,peer.downed,Object.keys(peer.statuses)])]);
  if(nextPartySignature!==partySignature){partySignature=nextPartySignature;party.replaceChildren();text(party,'h3','Party / '+Math.round(latency)+' ms');
    for(const peer of Object.values(room.players)){button(party,peer.name+' / '+Math.ceil(peer.hp)+' HP / '+peer.score+' points'+(peer.downed?' / DOWNED':''),()=>inspect(peer.id));if(Object.keys(peer.statuses).length)text(party,'small',Object.keys(peer.statuses).join(', '));}
    if(room.mode==='dungeon')text(party,'small',w.bossesRemaining?'Objectives: '+w.bossesRemaining+' required boss'+(w.bossesRemaining===1?'':'es')+' remaining':'Objectives complete — exit unlocked');
    const merchant=map.features?.find(f=>f.kind==='merchant'&&Math.hypot(f.x-predicted.x,f.y-predicted.y)<90);if(merchant){text(party,'small','Merchant: spend gold on a temporary tonic');button(party,'Health tonic / '+(merchant.value||8)+' gold',()=>act('merchant',{item:'health'}));button(party,'Shield tonic / '+((merchant.value||8)+3)+' gold',()=>act('merchant',{item:'shield'}));button(party,'Speed tonic / '+((merchant.value||8)+2)+' gold',()=>act('merchant',{item:'speed'}));}
    button(party,'Ping location (Q)',()=>act('ping',{x:predicted.x,y:predicted.y}));button(party,'Drink potion (H)',()=>act('potion'));button(party,'Emotes',()=>{const b=show('Say it without words');for(const value of ['Wave','Laugh','Point','Dance','Thumbs up'])button(b,value,()=>{act('emote',{value});$('frontModal').close();});});}
}
function inspect(id){const p=room.players[id],b=show(p.name+' / build');text(b,'p',p.weapon+' / '+p.perk);text(b,'p',JSON.stringify({relics:p.items,upgrades:p.upgrades}));if(id!==selfId&&room.mode!=='duel')for(const kind of ['gold','keys','potions'])button(b,'Give 1 '+kind,()=>act('trade',{target:id,kind,amount:1}));}
async function leave(){const was=active;active=false;pending=[];states=[];keys.clear();if(socket?.connected)await rpc('room:leave').catch(()=>{});room=null;map=null;selfId=null;socket?.disconnect();if(was)location.reload();else $('frontModal').close();}
function frame(now){const dt=Math.min(.1,(now-last)/1000);last=now;
  if(active&&predicted&&map){acc+=dt;while(acc>=TICK){acc-=TICK;input();}draw(now);}
  requestAnimationFrame(frame);
}
const lightCanvas=document.createElement('canvas'),lightCtx=lightCanvas.getContext('2d'),lightCache=new Map();
const graphicsQuality=()=>window.OMRV11?.meta.settings.graphicsQuality||'high';
function circle(x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
function rounded(x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
function diamond(x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x,y-r);ctx.lineTo(x+r*.72,y);ctx.lineTo(x,y+r);ctx.lineTo(x-r*.72,y);ctx.closePath();ctx.fill();}
const keyColors={red:'#e56e64',blue:'#77c7ee',green:'#83c977',purple:'#bd91e7',gold:'#e7bf58'};
function drawKey(p,time,low){const color=keyColors[p.keyType]||keyColors.blue,yy=p.y+Math.sin(time*4+p.id)*2;ctx.save();if(!low){ctx.shadowBlur=14;ctx.shadowColor=color;}ctx.translate(p.x,yy);ctx.rotate(Math.PI/4);rounded(-3,-13,6,20,2,color);circle(0,-13,7,color);ctx.fillStyle='#192620';ctx.beginPath();ctx.arc(0,-13,2.5,0,Math.PI*2);ctx.fill();rounded(-3,5,12,4,1,color);ctx.restore();}
function drawDecoration(d,time,low){const color={bush:'#547c4e',flowers:'#d998bc',roots:'#738d50',mushroom:'#c8898b',crystal:'#8fdaf0',rocks:'#6e817a',bones:'#d9ca9d',coral:'#79b9b1',embers:'#e47d52',debris:'#877262',statue:'#809086'}[d.kind]||'#6d8759';if(low){circle(d.x,d.y,4,color);return;}ctx.save();ctx.globalAlpha=.7;if(d.kind==='roots'){ctx.strokeStyle=color;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(d.x-8,d.y+7);ctx.quadraticCurveTo(d.x,d.y-10,d.x+9,d.y+7);ctx.stroke();}else if(d.kind==='crystal'){diamond(d.x,d.y-4,8,color);diamond(d.x+7,d.y+4,4,color);}else if(d.kind==='mushroom'){rounded(d.x-2,d.y-1,4,9,2,'#d8c2af');circle(d.x,d.y-3,6,color);}else{circle(d.x,d.y,7,color);circle(d.x+6,d.y+3,4,color);}ctx.restore();}
function label(x,y,value,color='#eff7e5',size=10){ctx.fillStyle=color;ctx.font='600 '+size+'px sans-serif';ctx.textAlign='center';ctx.fillText(value,x,y);}
function drawTile(x,y,tile,floor,wall,accent,time,low){
  const px=x*40,py=y*40,hash=(x*31+y*73)%19;
  ctx.fillStyle=low?floor:[floor,'#1d2b24','#202e26','#192820'][hash%4];ctx.fillRect(px,py,40,40);
  if(!low){ctx.strokeStyle='#07120c55';ctx.strokeRect(px+.5,py+.5,39,39);if(hash%4===0){ctx.strokeStyle=accent+'28';ctx.beginPath();ctx.moveTo(px+7,py+28);ctx.lineTo(px+18,py+26);ctx.lineTo(px+23,py+31);ctx.stroke();}if(hash%7===0){circle(px+9,py+9,2,accent+'35');circle(px+13,py+7,1.5,accent+'25');}}
  if(tile===1){
    if(low){ctx.fillStyle=wall;ctx.fillRect(px,py,39,39);return;}
    ctx.fillStyle='#050b08aa';ctx.fillRect(px+2,py+7,38,36);rounded(px+1,py-3,38,36,4,hash%3?wall:accent+'88');
    ctx.fillStyle='#ffffff16';ctx.fillRect(px+3,py-2,34,3);ctx.fillStyle='#050b083e';ctx.fillRect(px+3,py+29,34,5);
    ctx.strokeStyle='#07110c66';ctx.beginPath();ctx.moveTo(px+20,py);ctx.lineTo(px+20,py+13);ctx.lineTo(px+38,py+13);ctx.stroke();
    if(hash%3===0){circle(px+7,py+2,5,accent+'70');circle(px+12,py+4,3,accent+'90');}
  }
  if(tile===2){ctx.strokeStyle=accent+'88';ctx.lineWidth=2;ctx.strokeRect(px+9,py+9,22,22);}
  if(tile===3){ctx.save();ctx.shadowBlur=low?0:22;ctx.shadowColor=accent;ctx.strokeStyle=accent;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(px+20,py+21,15,10,0,0,Math.PI*2);ctx.stroke();ctx.restore();diamond(px+20,py+14+Math.sin(time*2)*3,7,accent);}
}
function featureArt(f,accent,time,low){
  const colors={lava:'#ef7046',water:'#3a9eb3',poison:'#a1c44f',roots:'#728c52',crystal:'#9ae9ff',merchant:'#f2c96f',lift:'#c7c0f2',platform:'#ba896b',bridge:'#a18356',secret:'#9a6ea6',switch:'#d5d18e','hidden-path':'#7ec8dc','submerged-vault':'#3a8893','living-root':'#708a4c',darkness:'#111827'};
  const color=colors[f.kind]||accent,pulse=1+Math.sin(time*2+f.x)*.08;
  if(low){circle(f.x,f.y,20,color+'90');return;}
  if(f.kind==='lava'||f.kind==='water'||f.kind==='poison'){ctx.save();ctx.globalAlpha=.42;circle(f.x,f.y,25*pulse,color);ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();ctx.arc(f.x,f.y,17+Math.sin(time*3+f.y)*3,0,Math.PI*2);ctx.stroke();ctx.restore();}
  else if(f.kind==='crystal'||f.kind==='hidden-path'){ctx.save();ctx.shadowBlur=18;ctx.shadowColor=color;diamond(f.x,f.y-5,15,color);diamond(f.x-12,f.y+6,8,color+'cc');ctx.restore();}
  else if(f.kind==='roots'||f.kind==='living-root'){ctx.strokeStyle=color;ctx.lineWidth=5;for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(f.x,f.y);ctx.quadraticCurveTo(f.x+(i-1.5)*10,f.y-12,f.x+(i-1.5)*15,f.y+18);ctx.stroke();}}
  else if(f.kind==='merchant'){rounded(f.x-15,f.y-12,30,26,8,'#493d2b');diamond(f.x,f.y-15,9,color);circle(f.x-5,f.y-3,2,'#fff0bd');circle(f.x+5,f.y-3,2,'#fff0bd');}
  else if(f.kind==='lift'){ctx.strokeStyle=color;ctx.lineWidth=3;ctx.beginPath();ctx.arc(f.x,f.y,21,0,Math.PI*2);ctx.stroke();for(let i=0;i<4;i++)diamond(f.x+Math.cos(i*Math.PI/2)*13,f.y+Math.sin(i*Math.PI/2)*13,4,color);}
  else {rounded(f.x-22,f.y-12,44,24,5,color+'99');ctx.strokeStyle=color;ctx.strokeRect(f.x-18,f.y-8,36,16);}
  if(['merchant','lift','switch'].includes(f.kind))label(f.x,f.y-31,f.kind.toUpperCase()+' / E',color,9);
}
function drawEnemyArt(e,time,low){
  const bob=low?0:Math.sin(time*3+e.id)*2,color=e.flash>0?'#f5e9c8':e.color||'#82976f';
  circle(e.x,e.y+11,e.boss?22:14,'#02070499');
  ctx.save();ctx.translate(e.x,e.y+bob);
  if(!low&&e.elite){ctx.shadowBlur=18;ctx.shadowColor='#efd070';ctx.strokeStyle='#efd070';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,e.boss?25:18,0,Math.PI*2);ctx.stroke();}
  if(!low&&e.raging){ctx.shadowBlur=18;ctx.shadowColor='#f28a5e';}
  if(e.boss){rounded(-20,-19,40,38,9,color);diamond(-16,-20,10,color);diamond(16,-20,10,color);rounded(-12,-8,24,14,5,'#303643');circle(-6,-3,3,'#ffeda9');circle(6,-3,3,'#ffeda9');diamond(0,13,6,'#ead4ef');}
  else if(e.behavior==='sentry'){rounded(-13,-12,26,25,3,color);diamond(0,0,7,'#233c38');circle(0,-1,3,'#ffe19a');}
  else {ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(0,1,14,12,0,Math.PI,0);ctx.lineTo(14,9);ctx.quadraticCurveTo(0,14,-14,9);ctx.closePath();ctx.fill();circle(-5,1,2,'#142116');circle(5,1,2,'#142116');if(e.behavior==='charger'){diamond(-11,-11,6,'#ead2a5');diamond(11,-11,6,'#ead2a5');}if(e.behavior==='spitter')circle(0,7,4,'#543d28');}
  ctx.restore();
  if(e.windup>0){ctx.strokeStyle='#f8b182';ctx.setLineDash(low?[]:[7,5]);ctx.lineWidth=2;ctx.beginPath();ctx.arc(e.x,e.y,27,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
  if(e.hp<e.maxHp||e.boss){rounded(e.x-20,e.y-(e.boss?36:24),40,4,2,'#2f262c');rounded(e.x-20,e.y-(e.boss?36:24),40*Math.max(0,e.hp/e.maxHp),4,2,color);}
  if(e.boss)label(e.x,e.y-44,e.name+(e.raging?' / ENRAGED':''),e.raging?'#ffc08d':'#e8dced',10);
}
function drawPlayerArt(peer,p,time,low){
  const color=colors[peer.skin]||'#b0ce99',bob=low?0:Math.sin(time*8+peer.id.length)*1.2;
  circle(p.x,p.y+12,14,'#020704aa');ctx.save();ctx.translate(p.x,p.y+bob);if(peer.downed)ctx.rotate(Math.PI/2);
  ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(0,-14);ctx.quadraticCurveTo(15,-7,13,12);ctx.lineTo(-13,12);ctx.quadraticCurveTo(-15,-7,0,-14);ctx.fill();
  if(!low){rounded(-8,-6,16,10,4,'#273d2c');circle(-3,-2,1.5,'#f2f0d7');circle(3,-2,1.5,'#f2f0d7');ctx.strokeStyle='#e0c491';ctx.lineWidth=3;const a=peer.id===selfId?Math.atan2(mouse.y/view.scale+view.y-p.y,mouse.x/view.scale+view.x-p.x):0;ctx.beginPath();ctx.moveTo(Math.cos(a)*8,Math.sin(a)*8);ctx.lineTo(Math.cos(a)*23,Math.sin(a)*23);ctx.stroke();diamond(Math.cos(a)*23,Math.sin(a)*23,4,'#f0ae6e');}
  ctx.restore();label(p.x,p.y-22,peer.name+' / '+Math.ceil(peer.hp),peer.id===selfId?'#f1f7dc':'#b9d9d1',9);
}
function wallAt(x,y){const tx=Math.floor(x/40),ty=Math.floor(y/40);return ty<0||tx<0||ty>=map.grid.length||tx>=map.grid[0].length||map.grid[ty][tx]===1;}
function lightPolygon(source,radius,rays){const points=[];for(let i=0;i<rays;i++){const a=i/rays*Math.PI*2,dx=Math.cos(a),dy=Math.sin(a);let r=0;for(;r<radius;r+=8)if(wallAt(source.x+dx*r,source.y+dy*r))break;points.push({x:source.x+dx*Math.min(radius,r+4),y:source.y+dy*Math.min(radius,r+4)});}return points;}
function drawLightLayer(rect,dpr,low){
  ctx.setTransform(dpr,0,0,dpr,0,0);const radius=(predicted.wideLight?300:200)*view.scale;
  if(low){const g=ctx.createRadialGradient(rect.width/2,rect.height/2,20,rect.width/2,rect.height/2,radius);g.addColorStop(0,'#02060800');g.addColorStop(1,map.lighting==='dark'?'#020608e8':'#020608a5');ctx.fillStyle=g;ctx.fillRect(0,0,rect.width,rect.height);return;}
  const w=Math.ceil(rect.width),h=Math.ceil(rect.height);if(lightCanvas.width!==w||lightCanvas.height!==h){lightCanvas.width=w;lightCanvas.height=h;}
  const c=lightCtx;c.setTransform(1,0,0,1,0,0);c.globalCompositeOperation='source-over';c.clearRect(0,0,w,h);c.fillStyle=map.lighting==='dark'?'rgba(2,7,8,.95)':map.lighting==='bright'?'rgba(2,7,8,.48)':'rgba(2,7,8,.82)';c.fillRect(0,0,w,h);c.globalCompositeOperation='destination-out';
  const sources=[{x:predicted.x,y:predicted.y,r:predicted.wideLight?300:200},...room.world.torches.map(t=>({x:t.x,y:t.y,r:150,torch:true}))];
  for(const source of sources){const sx=(source.x-view.x)*view.scale,sy=(source.y-view.y)*view.scale,r=source.r*view.scale;if(sx+r<0||sy+r<0||sx-r>w||sy-r>h)continue;const key=source.torch?source.x+','+source.y+','+map.id:'';let points=key&&lightCache.get(key);if(!points){points=lightPolygon(source,source.r,72);if(key)lightCache.set(key,points);}c.save();c.beginPath();points.forEach((p,i)=>{const x=(p.x-view.x)*view.scale,y=(p.y-view.y)*view.scale;i?c.lineTo(x,y):c.moveTo(x,y);});c.closePath();c.clip();const g=c.createRadialGradient(sx,sy,r*.08,sx,sy,r);g.addColorStop(0,'rgba(0,0,0,1)');g.addColorStop(.5,'rgba(0,0,0,.96)');g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(sx-r,sy-r,r*2,r*2);c.restore();}
  c.globalCompositeOperation='source-over';ctx.drawImage(lightCanvas,0,0,w,h);
}
function drawMinimap(rect,wall,accent,low){
  const scale=(rect.width<500?75:105)/map.grid[0].length,mw=map.grid[0].length*scale,mh=map.grid.length*scale,mx=rect.width-mw-18,my=55;
  rounded(mx-6,my-6,mw+12,mh+12,5,'#04100bdd');for(let y=0;y<map.grid.length;y++)for(let x=0;x<map.grid[0].length;x++){if(map.grid[y][x]===1){ctx.fillStyle=low?wall:'#63745d';ctx.fillRect(mx+x*scale,my+y*scale,Math.max(1,scale),Math.max(1,scale));}else if(!low&&map.grid[y][x]===3){ctx.fillStyle=accent;ctx.fillRect(mx+x*scale,my+y*scale,2,2);}}
  for(const p of Object.values(room.players))circle(mx+p.x/40*scale,my+p.y/40*scale,p.id===selfId?3:2,p.id===selfId?'#fff3bd':'#91dfd0');
}
function draw(now){
  const rect=canvas.getBoundingClientRect(),low=graphicsQuality()==='low',dpr=low?1:Math.min(devicePixelRatio,2);if(rect.width<1||rect.height<1)return;
  if(canvas.width!==Math.round(rect.width*dpr)||canvas.height!==Math.round(rect.height*dpr)){canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);}
  view.w=rect.width;view.h=rect.height;view.scale=Math.min(1.2,rect.width/580);const vw=rect.width/view.scale,vh=rect.height/view.scale,maxX=map.grid[0].length*40-vw,maxY=map.grid.length*40-vh;view.x=Math.max(Math.min(predicted.x-vw/2,Math.max(0,maxX)),Math.min(0,maxX/2));view.y=Math.max(Math.min(predicted.y-vh/2,Math.max(0,maxY)),Math.min(0,maxY/2));
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#050b08';ctx.fillRect(0,0,rect.width,rect.height);ctx.scale(view.scale,view.scale);ctx.translate(-view.x,-view.y);
  const [floor,wall,accent]=palette[map.biome]||palette.moss,time=room.world.time;
  const y0=Math.max(0,Math.floor(view.y/40)-1),y1=Math.min(map.grid.length,Math.ceil((view.y+vh)/40)+1),x0=Math.max(0,Math.floor(view.x/40)-1),x1=Math.min(map.grid[0].length,Math.ceil((view.x+vw)/40)+1);
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)drawTile(x,y,map.grid[y][x],floor,wall,accent,time,low);
  const w=room.world;for(const d of map.decorations||[])if(d.x>=view.x-30&&d.x<=view.x+vw+30&&d.y>=view.y-30&&d.y<=view.y+vh+30)drawDecoration(d,time,low);for(const f of map.features)featureArt(f,accent,time,low);
  for(const t of w.torches){if(!low){ctx.save();ctx.shadowBlur=20;ctx.shadowColor='#ffb45d';diamond(t.x,t.y-8,9+Math.sin(time*7+t.x)*1.5,'#edb767');diamond(t.x,t.y-6,5,'#ffe3a3');ctx.restore();rounded(t.x-6,t.y,12,15,3,'#65523a');}else circle(t.x,t.y,7,'#ffd293');}
  for(const d of w.doors)if(!d.open){const color=keyColors[d.keyType]||keyColors.blue;rounded(d.x-16,d.y-19,32,38,4,color+'aa');if(!low){ctx.strokeStyle=color;ctx.lineWidth=2;ctx.strokeRect(d.x-12,d.y-15,24,30);circle(d.x+7,d.y+1,3,'#fff1b4');label(d.x,d.y-27,d.keyType.toUpperCase()+' LOCK',color,8);}}
  for(const c of w.chests){circle(c.x,c.y+9,16,'#03080599');ctx.save();if(!low&&!c.opened){ctx.shadowColor=c.kind==='vault'?'#df94dd':'#efc479';ctx.shadowBlur=15;}rounded(c.x-12,c.y-7,24,18,3,c.opened?'#584b33':c.kind==='vault'?'#8e5790':'#bc9050');ctx.restore();rounded(c.x-12,c.y-9,24,c.opened?4:8,2,c.opened?'#786343':c.kind==='vault'?'#e0a8e0':'#d9b675');if(!c.opened&&!low)diamond(c.x,c.y-19+Math.sin(time*3+c.x)*3,3,c.kind==='vault'?'#f2b8ef':'#ecd497');}
  for(const p of w.pickups){if(p.kind==='key'){drawKey(p,time,low);continue;}const color={gold:'#edcf7d',potion:'#e78b9a',upgrade:'#bcabef'}[p.kind]||accent;if(low)circle(p.x,p.y,6,color);else{ctx.save();ctx.shadowBlur=12;ctx.shadowColor=color;diamond(p.x,p.y+Math.sin(time*4+p.id)*2,7,color);ctx.restore();}}
  for(const trap of w.traps){const active=Math.sin(time*2.2)>.25;for(let i=0;i<(low?1:3);i++)diamond(trap.x+(i-1)*9,trap.y,active?9:4,active?'#d18b70':'#58644d');}
  ctx.save();ctx.shadowBlur=low?0:22;ctx.shadowColor=accent;ctx.strokeStyle=w.bossDead?'#b7efbd':'#617365';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(map.exit.x,map.exit.y,19,13,0,0,Math.PI*2);ctx.stroke();ctx.restore();diamond(map.exit.x,map.exit.y-6+Math.sin(time*2)*3,8,w.bossDead?'#b7efbd':'#617365');
  const when=now-100;let a=states[0],b=states.at(-1);for(let i=1;i<states.length;i++)if(states[i].at>=when){a=states[i-1];b=states[i];break;}const blend=(object,previous)=>{if(!a||!b||!previous)return object;const t=Math.max(0,Math.min(1,(when-a.at)/Math.max(1,b.at-a.at)));return {...object,x:previous.x+(object.x-previous.x)*t,y:previous.y+(object.y-previous.y)*t};};
  for(const e of b?.room.world.enemies||w.enemies){const p=blend(e,a?.room.world.enemies.find(x=>x.id===e.id));drawEnemyArt(p,time,low);}
  for(const bullet of w.bullets){if(!low){ctx.strokeStyle=bullet.color;ctx.lineWidth=bullet.hostile?5:3;ctx.beginPath();ctx.moveTo(bullet.x-bullet.vx*.03,bullet.y-bullet.vy*.03);ctx.lineTo(bullet.x,bullet.y);ctx.stroke();ctx.save();ctx.shadowBlur=9;ctx.shadowColor=bullet.color;}circle(bullet.x,bullet.y,bullet.r,bullet.color);if(!low)ctx.restore();}
  for(const peer of Object.values(b?.room.players||room.players)){const p=peer.id===selfId?predicted:blend(peer,a?.room.players[peer.id]);drawPlayerArt(peer,p,time,low);if(peer.emoteUntil>time)label(p.x,p.y-40,peer.emote,'#ffe5a3',10);}
  for(const ping of w.pings){ctx.strokeStyle='#f9e79c';ctx.lineWidth=2;ctx.beginPath();ctx.arc(ping.x,ping.y,24+Math.sin(time*5)*5,0,Math.PI*2);ctx.stroke();label(ping.x,ping.y-32,ping.kind,'#f9e79c',9);}
  if(!low)for(const t of w.torches)for(let i=0;i<3;i++){const seed=(t.x*7+t.y*11+i*29)%31,a=time*(.7+i*.13)+seed;circle(t.x+Math.sin(a)*14,t.y-10-Math.abs(Math.cos(a))*24,1.5,'#ffd68b99');}
  ctx.setTransform(dpr,0,0,dpr,0,0);drawLightLayer(rect,dpr,low);drawMinimap(rect,wall,accent,low);
}
document.querySelectorAll('[data-menu="play"],[data-menu="quickplay"]').forEach(b=>b.onclick=()=>openLobby('dungeon',b.dataset.menu==='quickplay'));
$('start').onclick=$('quickStart').onclick=()=>openLobby();$('retry').onclick=()=>leave();$('returnCamp').onclick=()=>leave();
$('pause').onclick=()=>active?act('pause'):null;$('leave').onclick=leave;$('touchDash').onclick=()=>dash=true;$('touchInteract').onclick=()=>act('interact');$('lanternToggle').onclick=()=>light=true;
window.addEventListener('keydown',e=>{if(!active||document.querySelector('dialog[open]'))return;const k=e.key.toLowerCase();keys.add(k);if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();if(e.repeat)return;if(k===' ')dash=true;if(k==='l')light=true;if(k==='e')act('interact');if(k==='h')act('potion');if(k==='q')act('ping',{x:mouse.x/view.scale+view.x,y:mouse.y/view.scale+view.y});if(k==='p')act('pause');});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>{keys.clear();mouse.down=false;stick={x:0,y:0};});document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();mouse.down=false;}});
canvas.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect();mouse.x=e.clientX-r.left;mouse.y=e.clientY-r.top;});canvas.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch')mouse.down=true;});window.addEventListener('pointerup',()=>mouse.down=false);
const joystick=$('joystick');joystick.onpointerdown=e=>{joystick.setPointerCapture(e.pointerId);};joystick.onpointermove=e=>{if(!joystick.hasPointerCapture(e.pointerId))return;const r=joystick.getBoundingClientRect(),x=(e.clientX-r.left-r.width/2)/35,y=(e.clientY-r.top-r.height/2)/35,n=Math.max(1,Math.hypot(x,y));stick={x:x/n,y:y/n};};joystick.onpointerup=joystick.onpointercancel=()=>stick={x:0,y:0};
setInterval(()=>{if(socket?.connected){const t=performance.now();socket.timeout(2000).emit('latency',latency,err=>{if(!err)latency=performance.now()-t;});}},2000);
setInterval(()=>{if(active)hud();},250);
requestAnimationFrame(frame);
