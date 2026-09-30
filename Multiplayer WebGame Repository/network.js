import { PROTOCOL,TICK,movementStep } from './shared/movement.js';
const $=id=>document.getElementById(id);
const local=['localhost','127.0.0.1'].includes(location.hostname);
const endpoint=local?location.origin:(document.querySelector('meta[name="omr-server-url"]')?.content.trim()||location.origin);
const palette={moss:['#17281d','#465940','#c3d695'],crystal:['#142338','#587998','#95e5ff'],sunken:['#112b34','#456b72','#87d8d3'],forge:['#311c19','#7f5142','#ffad72'],gardens:['#202d17','#5a7041','#c4e49a']};
const colors={moss:'#cce6a2',ember:'#ee9b6b',frost:'#8fc9e8',void:'#bb9be5',gold:'#e4c36f',creator:'#ec719c'};
let socket,room,map,selfId,active=false,seq=0,pending=[],predicted,states=[],keys=new Set(),mouse={x:0,y:0,down:false},dash=false,light=false,stick={x:0,y:0},acc=0,last=performance.now(),latency=0,mode='dungeon',generation=0;
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
  socket.on('server:hello',h=>{if(h.protocol!==PROTOCOL){error('Server update required: deploy v1.2.1 before playing.');socket.disconnect();}});
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
    const lobby=show('ROOM '+joined.code);text(lobby,'p',mode==='duel'?'Waiting for at least two players.':'Share this code with your friends.');
    const roster=text(lobby,'div','');roster.id='networkRoster';
    if(room.hostId===selfId)button(lobby,'Start run',async()=>{try{const map=biome.value==='custom'?window.OMR.selectedMap():undefined;await rpc('room:start',{map,mapId});}catch(e){error(e.message);}});
    button(lobby,'Leave',leave);renderRoster();
    if(solo&&mode!=='duel')await rpc('room:start',{map:biome.value==='custom'?window.OMR.selectedMap():undefined,mapId});
  }catch(e){error(e.message);}};
  button(b,quick?'Find a game':'Create / join room',()=>join(false));
  if(!quick&&mode!=='duel')button(b,'Play solo',()=>join(true));
  if(mode==='dungeon')button(b,'Browse published dungeons',async()=>{try{await connect();const r=await new Promise(resolve=>socket.emit('maps:list',resolve));const list=show('Published dungeons');if(!r.maps.length)text(list,'p','No published maps yet. Build one in the workshop.');for(const m of r.maps)button(list,m.name,()=>openLobby('dungeon',false,m.id));}catch(e){error(e.message);}});
}
function renderRoster(){const r=$('networkRoster');if(r&&room){r.replaceChildren();for(const p of Object.values(room.players))text(r,'p',p.name+(p.id===room.hostId?' / host':''));}}
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
  $('arenaName').textContent=map.name;$('phase').textContent=room.mode==='waves'?'WAVE '+w.wave:room.mode==='duel'?'ROUND '+room.round:'STAGE '+room.stage;
  $('healthText').textContent=Math.ceil(p.hp)+' / '+p.maxHp+(p.downed?' / DOWNED':'');$('healthBar').style.width=p.hp/p.maxHp*100+'%';
  $('gold').textContent=p.gold;$('kills').textContent=w.kills;$('stageText').textContent=room.mode==='waves'?'Wave '+w.wave:room.mode==='duel'?'Round '+room.round:room.stage+' / '+room.maxStages;
  $('runClock').textContent=Math.floor(w.time/60)+':'+String(Math.floor(w.time%60)).padStart(2,'0');
  $('lanternText').textContent=Math.floor(p.lantern)+'% light / '+p.keys+' keys / '+p.potions+' potions';$('lanternBar').style.width=p.lantern+'%';
  $('chestCost').textContent=(map.chestPricing.baseCost+map.chestPricing.increase*w.chestsOpened)+' gold';
  $('chestCostNote').textContent='+'+map.chestPricing.increase+' after each opening';
  $('worldMessage').textContent=w.message;$('worldMessage').classList.toggle('hidden',!w.message);
  const inv=$('inventory');inv.replaceChildren();for(const [id,n]of Object.entries({...p.items,...p.upgrades}))text(inv,'p',id+' x'+n);
  if(p.choices.length){text(inv,'p','Choose a relic:');for(const id of p.choices)button(inv,id,()=>act('relic',{id}));}
  $('relicCount').textContent=Object.values(p.items).reduce((a,b)=>a+b,0);
  let party=$('partyPanel');if(!party){party=document.createElement('div');party.id='partyPanel';$('synergy').before(party);}
  party.replaceChildren();text(party,'h3','Party / '+Math.round(latency)+' ms');
  for(const peer of Object.values(room.players)){button(party,peer.name+' / '+Math.ceil(peer.hp)+' HP / '+peer.score+' points'+(peer.downed?' / DOWNED':''),()=>inspect(peer.id));if(Object.keys(peer.statuses).length)text(party,'small',Object.keys(peer.statuses).join(', '));}
  button(party,'Ping location (Q)',()=>act('ping',{x:predicted.x,y:predicted.y}));button(party,'Drink potion (H)',()=>act('potion'));button(party,'Emotes',()=>{const b=show('Say it without words');for(const value of ['Wave','Laugh','Point','Dance','Thumbs up'])button(b,value,()=>{act('emote',{value});$('frontModal').close();});});
}
function inspect(id){const p=room.players[id],b=show(p.name+' / build');text(b,'p',p.weapon+' / '+p.perk);text(b,'p',JSON.stringify({relics:p.items,upgrades:p.upgrades}));if(id!==selfId&&room.mode!=='duel')for(const kind of ['gold','keys','potions'])button(b,'Give 1 '+kind,()=>act('trade',{target:id,kind,amount:1}));}
async function leave(){const was=active;active=false;pending=[];states=[];keys.clear();if(socket?.connected)await rpc('room:leave').catch(()=>{});room=null;map=null;selfId=null;socket?.disconnect();if(was)location.reload();else $('frontModal').close();}
function frame(now){const dt=Math.min(.1,(now-last)/1000);last=now;
  if(active&&predicted&&map){acc+=dt;while(acc>=TICK){acc-=TICK;input();}draw(now);}
  requestAnimationFrame(frame);
}
function draw(now){
  const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio,2);if(rect.width<1||rect.height<1)return;
  if(canvas.width!==Math.round(rect.width*dpr)||canvas.height!==Math.round(rect.height*dpr)){canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);}
  view.w=rect.width;view.h=rect.height;view.scale=Math.min(1.2,rect.width/580);view.x=predicted.x-rect.width/view.scale/2;view.y=predicted.y-rect.height/view.scale/2;
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#07100c';ctx.fillRect(0,0,rect.width,rect.height);ctx.scale(view.scale,view.scale);ctx.translate(-view.x,-view.y);
  const [floor,wall,accent]=palette[map.biome]||palette.moss;
  const circle=(x,y,r,color)=>{ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();};
  const label=(x,y,t)=>{ctx.fillStyle='#eff7e5';ctx.font='11px sans-serif';ctx.textAlign='center';ctx.fillText(t,x,y);};
  for(let y=Math.max(0,Math.floor(view.y/40));y<Math.min(map.grid.length,Math.ceil((view.y+rect.height/view.scale)/40));y++)for(let x=Math.max(0,Math.floor(view.x/40));x<Math.min(map.grid[0].length,Math.ceil((view.x+rect.width/view.scale)/40));x++){ctx.fillStyle=map.grid[y][x]===1?wall:floor;ctx.fillRect(x*40,y*40,39,39);}
  const w=room.world;
  for(const f of map.features){const color={lava:'#ee633f',water:'#2386a0',poison:'#93b34a',roots:'#67804e',crystal:'#95ddff',merchant:'#f0c36e',lift:'#bbb7ed',platform:'#b88665',bridge:'#96784f',secret:'#785986',switch:'#c9c589'}[f.kind]||accent;circle(f.x,f.y,24,color+'80');if(['merchant','lift','switch'].includes(f.kind))label(f.x,f.y-30,f.kind+' / E');}
  for(const t of w.torches)circle(t.x,t.y,7,'#ffd293');
  for(const d of w.doors)if(!d.open){ctx.fillStyle='#72a2b5';ctx.fillRect(d.x-18,d.y-20,36,40);}
  for(const c of w.chests){ctx.fillStyle=c.opened?'#534d38':c.kind==='vault'?'#d8a1d9':'#deb267';ctx.fillRect(c.x-12,c.y-9,24,18);}
  for(const p of w.pickups){circle(p.x,p.y,6,{gold:'#edcf7d',key:'#88d2ee',potion:'#e78b9a',upgrade:'#bcabef'}[p.kind]);}
  for(const t of w.traps)circle(t.x,t.y,15,Math.sin(w.time*2.2)>.25?'#e97559':'#734a39');
  circle(map.exit.x,map.exit.y,20,w.bossDead?'#8ce0c2':'#536458');
  // Interpolate remote bodies between received snapshots, approximately 100 ms behind.
  const when=now-100;let a=states[0],b=states.at(-1);for(let i=1;i<states.length;i++)if(states[i].at>=when){a=states[i-1];b=states[i];break;}
  const blend=(object,previous)=>{if(!a||!b||!previous)return object;const t=Math.max(0,Math.min(1,(when-a.at)/Math.max(1,b.at-a.at)));return {...object,x:previous.x+(object.x-previous.x)*t,y:previous.y+(object.y-previous.y)*t};};
  for(const e of b?.room.world.enemies||w.enemies){const p=blend(e,a?.room.world.enemies.find(x=>x.id===e.id));circle(p.x,p.y,e.boss?20:13,e.color);if(e.windup>0)circle(p.x,p.y,28,'#efaa7744');label(p.x,p.y-24,e.name+' '+Math.ceil(e.hp));}
  for(const bullet of w.bullets)circle(bullet.x,bullet.y,bullet.r,bullet.color);
  for(const peer of Object.values(b?.room.players||room.players)){const p=peer.id===selfId?predicted:blend(peer,a?.room.players[peer.id]);circle(p.x,p.y,peer.downed?8:12,colors[peer.skin]||'#b0ce99');label(p.x,p.y-24,peer.name+' / '+Math.ceil(peer.hp));if(peer.emoteUntil>w.time)label(p.x,p.y-40,peer.emote);}
  for(const ping of w.pings){ctx.strokeStyle='#f9e79c';ctx.lineWidth=2;ctx.beginPath();ctx.arc(ping.x,ping.y,24,0,Math.PI*2);ctx.stroke();label(ping.x,ping.y-30,ping.kind);}
  ctx.setTransform(dpr,0,0,dpr,0,0);
  const radius=(predicted.wideLight?290:190)*view.scale,g=ctx.createRadialGradient(rect.width/2,rect.height/2,20,rect.width/2,rect.height/2,radius);g.addColorStop(0,'#02060800');g.addColorStop(1,map.lighting==='dark'?'#020608ed':'#020608b0');ctx.fillStyle=g;ctx.fillRect(0,0,rect.width,rect.height);
  const scale=100/map.grid[0].length,mx=rect.width-110,my=55;ctx.fillStyle='#061009dd';ctx.fillRect(mx-4,my-4,108,map.grid.length*scale+8);for(let y=0;y<map.grid.length;y++)for(let x=0;x<map.grid[0].length;x++)if(map.grid[y][x]===1){ctx.fillStyle=wall;ctx.fillRect(mx+x*scale,my+y*scale,scale,scale);}for(const p of Object.values(room.players))circle(mx+p.x/40*scale,my+p.y/40*scale,2,p.id===selfId?'#fff':'#9be0ce');
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
