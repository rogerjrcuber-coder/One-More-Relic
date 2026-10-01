import { clamp,clear,distance,move,movementStep,sight,solid,TICK,type Input } from '../shared/movement.js';
import { biomes,weapons,relics,upgrades } from './content.js';
import { doorAt,generateMap,keyTypeAt,random } from './maps.js';
import type { Enemy,PlayerState,Projectile,RoomState,World } from './types.js';
const histories=new WeakMap<RoomState,{time:number;players:Record<string,{x:number;y:number}>}[]>();
export function newPlayer(id:string,name:string,skin='moss',weapon='wand',perk='vigor'):PlayerState {
  const maxHp=perk==='vigor'?125:100;
  return {id,name,skin,weapon:weapon in weapons?weapon as PlayerState['weapon']:'wand',perk:['vigor','swift','moss'].includes(perk)?perk:'vigor',x:0,y:0,r:11,hp:maxHp,maxHp,ready:false,connected:true,score:0,dash:0,dashCD:0,dashX:0,dashY:0,inv:0,fireCD:0,lantern:100,wideLight:false,heat:0,gold:0,keys:0,keyring:{red:0,blue:0,green:0,purple:0,gold:0},potions:1,items:{},upgrades:{},statuses:{},shield:0,shieldTimer:12,attacks:0,hits:0,lastSeq:0,latency:0,downed:false,revive:0,emote:'',emoteUntil:0,choices:[],input:null,inputAt:0,queue:[],lastReceived:0};
}
export function spawnPlayer(room:RoomState,p:PlayerState,index:number):void {
  const w=room.world!,start=w.map.spawns[index%w.map.spawns.length]!;
  let pos=start;
  for(let r=0;r<8;r++){let found=false;for(let y=-r;y<=r&&!found;y++)for(let x=-r;x<=r;x++){const c={x:start.x+x*40,y:start.y+y*40};if(clear(w.map.grid,c.x,c.y,11,w.doors)){pos=c;found=true;break;}}if(found)break;}
  Object.assign(p,pos,{hp:p.maxHp,downed:false,inv:2,dash:0,dashCD:0,fireCD:0,input:null,queue:[],lastSeq:0,lastReceived:0,choices:[],heat:0,statuses:{}});
  if(room.mode==='duel'){p.maxHp=p.hp=100;p.weapon='wand';p.perk='none';p.items={};p.upgrades={};p.gold=0;p.keys=0;p.keyring={red:0,blue:0,green:0,purple:0,gold:0};p.potions=0;p.shield=0;}
}
function enemy(room:RoomState,x:number,y:number,boss=false,config:Record<string,unknown>={}):Enemy {
  const w=room.world!,n=w.nextId++,rng=random(room.seed+n+room.round*67),theme=biomes[w.map.biome],kind=Math.floor(rng()*4),party=Object.keys(room.players).length;
  const elite=!boss&&(rng()<Math.min(.5,.08+room.stage*.05+w.wave*.01)||w.map.event==='Elite hunt');
  const hp=clamp(Number(config.hp)||(boss?650:55+kind*10),10,3000)*(1+(room.stage-1)*.25+w.wave*.05)*(1+(party-1)*(boss?.35:.1))*(elite?1.5:1)*(boss&&w.map.event==='Empowered boss'?1.4:1);
  return {id:n,x,y,r:boss?16:12,name:String(config.name||(boss?theme.boss:theme.enemies[kind])).slice(0,40),hp,maxHp:hp,damage:clamp(Number(config.damage)||(boss?20:10),1,80),speed:clamp(Number(config.speed)||(kind===3?0:55),0,150),boss,elite,behavior:String(config.behavior||(boss?'fan':['chaser','spitter','charger','sentry'][kind])),color:theme.color,cd:1,flash:0,target:null,alert:0,windup:0,chargeAngle:0,chargeTime:0,raging:false,statuses:{},dead:false,animation:'idle',dash:0,dashCD:0,dashX:0,dashY:0,perk:'none',requiredBoss:true,finalBoss:false};
}
export function loadWorld(room:RoomState):void {
  histories.set(room,[]);
  room.revision++;room.paused=false;
  const map=room.customMap&&room.mode==='dungeon'?structuredClone(room.customMap):generateMap(room.seed,room.stage,room.mode,room.biome,room.arenaIndex);
  if(room.customMap){
    map.name+=' / Stage '+room.stage;
    // Rotate authored sections for later stages without changing saved blueprints.
    if(room.stage%2===0){
      const width=map.grid[0]!.length*40,height=map.grid.length*40;
      map.grid=map.grid.slice().reverse().map(row=>row.slice().reverse());
      map.spawns=map.spawns.map(p=>({x:width-p.x,y:height-p.y}));map.exit={x:width-map.exit.x,y:height-map.exit.y};
      map.creatures=Object.fromEntries(Object.entries(map.creatures).map(([key,value])=>{const [x,y]=key.split(',').map(Number);return [(width/40-1-x!)+','+(height/40-1-y!),value];}));
    }
  }
  room.world={map,enemies:[],bullets:[],pickups:[],chests:[],doors:[],torches:[],traps:[],time:0,roundTime:0,wave:room.mode==='waves'?(room.stage-1)*5+1:0,kills:0,chestsOpened:0,bossDead:room.mode!=='dungeon',bossesRemaining:0,message:map.event,transition:0,winner:null,nextId:1,spawnTimer:5,pings:[]};
  const w=room.world;
  for(let y=0;y<map.grid.length;y++)for(let x=0;x<map.grid[0]!.length;x++) {
    const t=map.grid[y]![x],p={x:x*40+20,y:y*40+20};
    if((t===4||t===7)&&room.mode==='dungeon'){
      const e=enemy(room,p.x,p.y,t===7,map.creatures[x+','+y]|| (t===7?{behavior:map.biome==='forge'?'charger':map.biome==='crystal'?'ring':'fan'}:{}));
      if(t===7){const boss=map.bosses?.[x+','+y];e.requiredBoss=boss?.required!==false;e.finalBoss=boss?.final===true;w.bossesRemaining+=e.requiredBoss?1:0;}w.enemies.push(e);
      if(t===4&&!room.customMap){const count=Math.floor(random(room.seed+x+y+room.stage)()*3);for(let i=0;i<count;i++){const pos={x:p.x+(i?40:-40),y:p.y+40};if(clear(map.grid,pos.x,pos.y,12))w.enemies.push(enemy(room,pos.x,pos.y));}}
    }
    if(t===5||t===11)w.chests.push({...p,id:w.nextId++,opened:false,kind:t===11?'vault':'upgrade'});
    if(t===9)w.pickups.push({...p,id:w.nextId++,kind:'key',value:1,keyType:keyTypeAt(map,x,y),magnetSpeed:0});
    if(t===10){const door=doorAt(map,x,y);w.doors.push({...p,id:w.nextId++,open:false,keyType:door.type,name:door.name});}
    if(t===8)w.torches.push(p);if(t===6)w.traps.push(p);
  }
  if(room.mode==='dungeon')w.bossDead=w.bossesRemaining===0;
  Object.values(room.players).forEach((p,i)=>spawnPlayer(room,p,i));
  if(room.mode==='waves')spawnWave(room);
}
function spawnWave(room:RoomState):void {
  const w=room.world!,rng=random(room.seed+w.wave*97),count=Math.min(70,4+w.wave*2+Object.keys(room.players).length*2);
  for(let i=0;i<count;i++){const base=w.map.spawns[i%w.map.spawns.length]!;const x=base.x+(rng()-.5)*120,y=base.y+(rng()-.5)*120;const p=clear(w.map.grid,x,y,16,w.doors)?{x,y}:base;w.enemies.push(enemy(room,p.x,p.y,i===0&&w.wave%5===0));}
  w.message='Wave '+w.wave+': '+w.map.event;
}
export function receiveInput(room:RoomState,p:PlayerState,raw:unknown,now:number):boolean {
  if(!raw||typeof raw!=='object'||room.status!=='playing')return false;
  const a=raw as Input;
  if(!Number.isSafeInteger(a.seq)||a.seq<=p.lastReceived||a.revision!==room.revision||!Number.isFinite(a.x)||!Number.isFinite(a.y)||!Number.isFinite(a.aimX)||!Number.isFinite(a.aimY)||p.queue.length>=12)return false;
  p.lastReceived=a.seq;p.inputAt=now;
  p.queue.push({seq:a.seq,revision:a.revision,x:clamp(a.x,-1,1),y:clamp(a.y,-1,1),aimX:clamp(a.aimX,-1000,4000),aimY:clamp(a.aimY,-1000,4000),fire:a.fire===true,dash:a.dash===true,light:a.light===true});return true;
}
function hurt(target:PlayerState|Enemy,damage:number):void {
  if(target.hp<=0)return;
  if('inv' in target){if(target.inv>0)return;if(target.shield>0){const blocked=Math.min(target.shield,damage);target.shield-=blocked;damage-=blocked;}target.inv=.35;}
  target.hp=Math.max(0,target.hp-damage);if('downed' in target&&target.hp===0)target.downed=true;
  if('flash' in target)target.flash=.12;
}
function bullet(w:World,owner:string,x:number,y:number,a:number,speed:number,damage:number,color:string,extras:Partial<Projectile>={}):void {
  if(w.bullets.length>=350)return;
  w.bullets.push({id:w.nextId++,owner,x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,damage,color,life:2.5,r:4,pierce:1,hit:[],hostile:false,fire:0,poison:0,ice:0,chain:0,bounces:0,...extras});
}
function shoot(room:RoomState,p:PlayerState,input:Input):void {
  const w=room.world!,weapon=weapons[p.weapon],angle=Math.atan2(input.aimY-p.y,input.aimX-p.x),mult=(1+.15*(p.items.fang||0))*(p.hp<p.maxHp*.5?1+.35*(p.items.crown||0):1);
  p.attacks++;const echoes=p.attacks%5===0?Math.min(4,p.items.echo||0):0;
  const spread=p.upgrades.triple?[-.23,0,.23]:weapon.spread;
  for(let copy=0;copy<=echoes;copy++)for(const offset of spread)bullet(w,p.id,p.x,p.y,angle+offset+copy*.09,weapon.speed,weapon.damage*mult*(random(w.nextId+room.seed)()<.08*(p.upgrades.critical||0)?1.8:1),weapon.color,{pierce:weapon.pierce,fire:p.upgrades.fire||0,poison:p.upgrades.poison||0,ice:p.upgrades.ice||0,chain:p.upgrades.chain||0});
  p.fireCD=weapon.rate/(1+.12*(p.items.quill||0)+.15*(p.upgrades.rapid||0));
}
function statuses(e:PlayerState|Enemy,dt:number):void {for(const key of Object.keys(e.statuses)){e.statuses[key]=Math.max(0,e.statuses[key]!-dt);if(e.statuses[key]!>0&&['poison','burn'].includes(key))hurt(e,4*dt);if(e.statuses[key]===0)delete e.statuses[key];}}
function reward(p:PlayerState,id:string,kind:'items'|'upgrades'):void {p[kind][id]=(p[kind][id]||0)+1;if(id==='shield')p.shield+=18;}
function keyTotal(p:PlayerState):void {p.keys=Object.values(p.keyring).reduce((n,v)=>n+v,0);}
export function action(room:RoomState,p:PlayerState,raw:unknown):string {
  if(!room.world||room.status!=='playing'||!raw||typeof raw!=='object')return 'No active run';
  const a=raw as Record<string,unknown>,w=room.world;
  if(a.type==='pause'){if(Object.keys(room.players).length>1)return 'The world keeps running with a party';room.paused=!room.paused;return '';}
  if(p.downed)return 'Wait for a teammate to revive you';
  if(a.type==='emote'){if(!['Wave','Laugh','Point','Dance','Thumbs up'].includes(String(a.value)))return 'Unknown emote';p.emote=String(a.value);p.emoteUntil=w.time+3;return '';}
  if(a.type==='ping'){const x=Number(a.x),y=Number(a.y);if(!Number.isFinite(x)||!Number.isFinite(y)||distance(p,{x,y})>600)return 'Ping nearby';w.pings=w.pings.filter(q=>q.owner!==p.id);w.pings.push({id:p.id,owner:p.id,x,y,kind:String(a.kind||'Location').slice(0,20),expires:w.time+5});return '';}
  if(a.type==='trade'){const target=room.players[String(a.target)],kind=String(a.kind),n=Number(a.amount);if(!target||target===p||target.downed||distance(p,target)>100||room.mode==='duel'||!['gold','keys','potions'].includes(kind)||!Number.isSafeInteger(n)||n<1)return 'Invalid transfer';const k=kind as 'gold'|'keys'|'potions';if(p[k]<n)return 'Not enough to give';p[k]-=n;target[k]+=n;return '';}
  if(a.type==='potion'){if(p.potions<=0)return 'No potions';p.potions--;p.hp=Math.min(p.maxHp,p.hp+45);return '';}
  if(a.type==='merchant'){
    const f=w.map.features.find(q=>q.kind==='merchant'&&distance(p,q)<70);if(!f)return 'Move near a merchant';
    const item=String(a.item||'health'),offers={health:{cost:f.value||8,heal:45},shield:{cost:(f.value||8)+3,shield:30},speed:{cost:(f.value||8)+2,speed:1}} as const,offer=offers[item as keyof typeof offers]||offers.health;
    if(p.gold<offer.cost)return item+' tonic costs '+offer.cost+' gold';p.gold-=offer.cost;
    if('heal'in offer)p.hp=Math.min(p.maxHp,p.hp+offer.heal);if('shield'in offer)p.shield+=offer.shield;if('speed'in offer)p.statuses.swift=45;return 'Purchased '+item+' tonic';
  }
  if(a.type==='relic'){const id=String(a.id);if(!p.choices.includes(id))return 'Choose an offered relic';reward(p,id,'items');p.choices=[];return '';}
  if(a.type==='interact'){
    const ally=Object.values(room.players).find(t=>t.downed&&distance(p,t)<55);
    if(ally&&room.mode!=='duel'){ally.revive++;if(ally.revive>=3){ally.downed=false;ally.hp=Math.ceil(ally.maxHp*.4);ally.inv=2;ally.revive=0;}return ally.downed?'Reviving: interact three times':'';}
    const door=w.doors.find(d=>!d.open&&distance(p,d)<58);if(door){if((p.keyring[door.keyType]||0)<1)return 'Need a '+door.keyType+' key for '+door.name;p.keyring[door.keyType]--;keyTotal(p);door.open=true;return '';}
    const chest=w.chests.find(c=>!c.opened&&distance(p,c)<62&&sight(w.map.grid,p,c,w.doors));
    if(chest){if(w.map.features.some(f=>f.kind==='secret'&&f.active&&distance(chest,f)<25))return 'Find the hidden vault switch';if(p.choices.length)return 'Choose your pending relic';const price=(w.map.chestPricing.baseCost+w.map.chestPricing.increase*w.chestsOpened)*(chest.kind==='vault'?3:1);if(p.gold<price)return 'Need '+price+' gold';p.gold-=price;chest.opened=true;w.chestsOpened++;if(chest.kind==='vault'){const start=(w.nextId+++room.seed)%relics.length;p.choices=[0,1,2].map(i=>relics[(start+i)%relics.length]!);}else reward(p,upgrades[(w.nextId++)%upgrades.length]!,'upgrades');return '';}
    const f=w.map.features.find(f=>['merchant','lift','switch','submerged-vault'].includes(f.kind)&&distance(p,f)<60);
    if(f?.kind==='merchant')return 'Merchant nearby: choose a tonic from the party panel';
    if(f?.kind==='lift'&&f.target&&clear(w.map.grid,f.target.x,f.target.y,11,w.doors)){Object.assign(p,f.target);p.queue=[];return '';}
    if(f?.kind==='switch'){for(const s of w.map.features)if(s.kind==='secret')s.active=false;w.message='A hidden vault is revealed';return '';}
    if(f?.kind==='submerged-vault'&&f.active){const cost=12;if(p.gold<cost)return 'The submerged vault needs '+cost+' gold';p.gold-=cost;f.active=false;reward(p,'moss','items');return '';}
    return 'Move near a chest, door, teammate, merchant or lift';
  }
  return 'Unknown action';
}
export function stepRoom(room:RoomState,now=Date.now(),dt=TICK):void {
  const w=room.world;if(!w||room.status!=='playing'||room.paused)return;
  room.tick++;w.time+=dt;w.roundTime+=dt;w.pings=w.pings.filter(p=>p.expires>w.time);
  for(const f of w.map.features)if(f.kind==='platform'){
    if(!f.target)f.target={x:f.x,y:f.y};
    const x=f.target.x+Math.sin(w.time*.7)*60,dx=x-f.x;
    for(const p of Object.values(room.players))if(!p.downed&&distance(p,f)<25)move(p,dx,0,w.map.grid,w.doors);
    f.x=x;
  }
  const players=Object.values(room.players),alive=players.filter(p=>!p.downed);
  if(room.mode==='duel'&&players.length<2){w.roundTime=0;w.message='Waiting for another duelist';return;}
  if(w.transition>0){w.transition-=dt;if(w.transition<=0){if(room.mode==='duel'){room.round++;room.arenaIndex=(room.arenaIndex+1)%14;loadWorld(room);}else if(room.mode==='waves'){if(w.wave%5===0){room.stage++;room.arenaIndex=(room.arenaIndex+1)%14;loadWorld(room);}else{w.wave++;spawnWave(room);}}else if(room.stage<room.maxStages){room.stage++;loadWorld(room);}else{room.status='results';w.message='Dungeon cleared';}}return;}
  for(const p of players){
    p.inv=Math.max(0,p.inv-dt);p.fireCD=Math.max(0,p.fireCD-dt);statuses(p,dt);
    if(p.downed){p.queue=[];continue;}
    const input=p.queue.shift();if(input){p.lastSeq=input.seq;p.input=input;}
    if(input&&now-p.inputAt<400){let slow=p.statuses.ice?.55:1;for(const f of w.map.features)if(distance(p,f)<45){if(f.kind==='water')slow*=.65;if(f.kind==='roots')slow*=.7;}movementStep(p,input,w.map.grid,w.doors,dt,slow);if(input.light)p.wideLight=!p.wideLight;if(input.fire&&p.fireCD<=0)shoot(room,p,input);}
    const recharge=w.torches.some(t=>distance(t,p)<85);p.lantern=clamp(p.lantern+(recharge?32:p.wideLight?-14:8)*dt,0,100);if(!p.lantern)p.wideLight=false;
    p.shieldTimer-=dt;if(p.shieldTimer<=0){p.shieldTimer=12;p.shield=Math.max(p.shield,18*(p.upgrades.shield||0));}
    for(const f of w.map.features)if(distance(p,f)<30){
      if(f.kind==='poison')p.statuses.poison=2;
      if(f.kind==='living-root'&&Math.sin(w.time)>.2)p.statuses.ice=1;
      if(f.kind==='lava'&&!w.map.features.some(platform=>['platform','bridge'].includes(platform.kind)&&distance(p,platform)<28)){p.heat=clamp(p.heat+dt*20,0,100);hurt(p,8);}
      if(f.kind==='crystal'&&p.wideLight){p.lantern=Math.min(100,p.lantern+dt*20);f.active=false;for(const path of w.map.features)if(path.kind==='hidden-path'){path.active=false;const door=w.doors.find(d=>distance(d,path)<5);if(door)door.open=true;}}
    }
    if(p.dash>0&&p.items.cinder)for(const e of w.enemies)if(distance(p,e)<35)e.statuses.burn=2+p.items.cinder;
    p.heat=Math.max(0,p.heat-dt*3);if(p.heat>70)p.statuses.burn=2;
    for(const t of w.traps)if(distance(t,p)<20&&Math.sin(w.time*2.2)>.25)hurt(p,10);
    for(const item of w.pickups)if(item.value>0&&distance(item,p)<22){if(item.kind==='gold'){p.gold+=item.value;p.hp=Math.min(p.maxHp,p.hp+3*(p.items.moss||0)+(p.perk==='moss'?2:0));}if(item.kind==='key'){const type=item.keyType||'blue';p.keyring[type]+=item.value;keyTotal(p);}if(item.kind==='potion')p.potions+=item.value;if(item.kind==='upgrade')reward(p,item.upgrade||'rapid','upgrades');item.value=0;}
  }
  for(const item of w.pickups)if(item.value>0&&(item.kind==='gold'||item.kind==='key')){
    const target=alive.reduce<PlayerState|null>((best,p)=>!best||distance(item,p)<distance(item,best)?p:best,null),radius=item.kind==='key'?150:120;
    if(target&&distance(item,target)<radius){item.magnetSpeed=Math.min(item.kind==='key'?440:350,(item.magnetSpeed||0)+900*dt);const d=Math.max(1,distance(item,target));item.x+=(target.x-item.x)/d*item.magnetSpeed*dt;item.y+=(target.y-item.y)/d*item.magnetSpeed*dt;}
  }
  w.pickups=w.pickups.filter(p=>p.value>0);
  for(const e of w.enemies){if(e.dead)continue;statuses(e,dt);e.cd-=dt;e.flash=Math.max(0,e.flash-dt);const target=alive.reduce<PlayerState|null>((best,p)=>!best||distance(e,p)<distance(e,best)?p:best,null);e.target=target?.id||null;if(!target)continue;
    const d=distance(e,target),visible=sight(w.map.grid,e,target,w.doors);e.alert=d<600?5:Math.max(0,e.alert-dt);e.raging=e.boss&&e.hp<e.maxHp*.35;e.animation=e.windup>0?'casting':e.alert?'moving':'idle';
    if(e.windup>0){e.windup-=dt;if(e.windup<=0)e.chargeTime=.4;}
    else if(e.chargeTime>0){e.chargeTime-=dt;move(e,Math.cos(e.chargeAngle)*300*dt,Math.sin(e.chargeAngle)*300*dt,w.map.grid,w.doors);}
    else if(e.alert&&d>24){let a=Math.atan2(target.y-e.y,target.x-e.x);if(!visible){const options=[a,a+Math.PI/2,a-Math.PI/2];a=options.find(v=>clear(w.map.grid,e.x+Math.cos(v)*25,e.y+Math.sin(v)*25,e.r,w.doors))??a;}const speed=e.speed*(e.raging?1.3:1)*(e.statuses.ice?.5:1)*(e.behavior==='spitter'&&d<150?-1:1);move(e,Math.cos(a)*speed*dt,Math.sin(a)*speed*dt,w.map.grid,w.doors);}
    if(e.cd<=0&&visible&&d<440){e.cd=e.raging?1.2:2.4;const a=Math.atan2(target.y-e.y,target.x-e.x);if(e.behavior==='charger'){e.windup=.65;e.chargeAngle=a;}else if(e.behavior!=='chaser'){const count=e.boss?7:3;for(let i=0;i<count;i++)bullet(w,'enemy:'+e.id,e.x,e.y,e.behavior==='ring'?a+i*Math.PI*2/count:a+(i-(count-1)/2)*.18,170,e.damage,e.color,{hostile:true});}if(e.boss&&players.length>=4&&w.enemies.length<80){const pos={x:e.x+40,y:e.y};if(clear(w.map.grid,pos.x,pos.y,12,w.doors))w.enemies.push(enemy(room,pos.x,pos.y));}}
    for(const p of alive)if(distance(e,p)<e.r+p.r+2)hurt(p,e.damage);
    if(e.hp<=0){e.dead=true;e.animation='dead';w.kills++;if(e.boss){if(e.requiredBoss)w.bossesRemaining=Math.max(0,w.bossesRemaining-1);for(const p of players)reward(p,{moss:'crown',crystal:'storm',sunken:'moss',forge:'cinder',gardens:'beetle'}[w.map.biome],'items');}
      for(const p of players)for(let i=0;i<Math.min(4,p.items.beetle||0);i++){const target=w.enemies.find(t=>t.hp>0&&t!==e);if(target)bullet(w,p.id,e.x,e.y,Math.atan2(target.y-e.y,target.x-e.x),300,18,'#b4e9c7');}
      w.pickups.push({id:w.nextId++,x:e.x,y:e.y,kind:'gold',value:e.boss?20:4});if(e.id%7===0)w.pickups.push({id:w.nextId++,x:e.x+10,y:e.y,kind:'potion',value:1});}
  }
  for(const b of w.bullets){b.life-=dt;const steps=Math.max(1,Math.ceil(Math.hypot(b.vx,b.vy)*dt/5));for(let i=0;i<steps&&b.life>0;i++){const nx=b.x+b.vx*dt/steps,ny=b.y+b.vy*dt/steps;if(solid(w.map.grid,nx,ny,w.doors)){if(w.map.biome==='crystal'&&b.bounces<1){b.vx=-b.vx;b.vy=-b.vy;b.bounces++;}else b.life=0;break;}b.x=nx;b.y=ny;
    const targets:(PlayerState|Enemy)[]=b.hostile?alive:room.mode==='duel'?alive.filter(p=>p.id!==b.owner):w.enemies.filter(e=>!e.dead);
    for(const t of targets){
      const id=String(t.id),owner=room.players[b.owner],rewind=room.mode==='duel'&&owner?Math.min(.15,owner.latency/2000):0;
      const history=histories.get(room)||[],past=rewind?history.find(h=>h.time>=w.time-rewind)?.players[id]:undefined;
      const hit=distance(b,t)<=b.r+t.r||past&&distance(b,past)<=b.r+t.r&&sight(w.map.grid,b,t,w.doors);
      if(t.hp<=0||b.hit.includes(id)||!hit)continue;b.hit.push(id);hurt(t,b.damage);if(b.poison)t.statuses.poison=2+b.poison;if(b.ice)t.statuses.ice=2;if(b.fire)t.statuses.burn=2;
      const shooter=room.players[b.owner];if(shooter){shooter.hits++;if(b.chain||shooter.items.storm&&shooter.hits%8===0)for(const other of targets)if(other!==t&&distance(t,other)<100)hurt(other,12+16*(shooter.items.storm||0));}
      if(--b.pierce<=0){b.life=0;break;}
    }
  }}
  w.bullets=w.bullets.filter(b=>b.life>0);w.enemies=w.enemies.filter(e=>!e.dead);if(room.mode==='dungeon')w.bossDead=w.bossesRemaining===0;
  const history=histories.get(room)||[];history.push({time:w.time,players:Object.fromEntries(players.map(p=>[p.id,{x:p.x,y:p.y}]))});while(history.length>8)history.shift();histories.set(room,history);
  if(room.mode==='duel'){
    w.spawnTimer-=dt;if(w.spawnTimer<=0){w.spawnTimer=8;const spot=w.map.spawns[w.nextId%w.map.spawns.length]!;w.pickups.push({id:w.nextId++,x:spot.x,y:spot.y,kind:'upgrade',value:1,upgrade:upgrades[w.nextId%upgrades.length]});}
    const survivors=players.filter(p=>!p.downed);if(players.length>=2&&(survivors.length<=1||w.roundTime>=480)){const winner=survivors.length===1?survivors[0]:undefined;if(winner)winner.score++;w.winner=winner?.id||null;w.message=winner?winner.name+' wins the round':'Round drawn';w.transition=4;}
    if(w.roundTime>180)for(const p of survivors)if(distance(p,w.map.exit)>Math.max(80,650-(w.roundTime-180)*2))hurt(p,8);
  }else if(!players.some(p=>!p.downed)){room.status='results';w.message='The party has fallen';}
  else if(room.mode==='waves'&&!w.enemies.length){w.transition=4;for(const p of players){p.gold+=5;p.hp=Math.min(p.maxHp,p.hp+25);reward(p,'rapid','upgrades');}w.message='Wave '+w.wave+' cleared';}
  else if(room.mode==='dungeon'&&w.bossDead&&alive.some(p=>distance(p,w.map.exit)<25)){w.transition=3;w.message='Descending together';}
}
