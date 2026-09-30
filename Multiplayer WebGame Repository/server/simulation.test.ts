import assert from 'node:assert/strict';
import test from 'node:test';
import { RoomStore } from './rooms.js';
import { action,receiveInput,stepRoom,loadWorld } from './simulation.js';
import { clear,TICK } from '../shared/movement.js';
import { generateMap,validateMap } from './maps.js';
import { biomes,duelArenas,wavesArenas,type Biome } from './content.js';
function run(mode:'dungeon'|'waves'|'duel'='dungeon'){
  const store=new RoomStore(),room=store.join('a',{mode,name:'A'});
  store.join('b',{code:room.code,mode,name:'B'});store.start(room,'a');return {store,room};
}
test('sustained acknowledged movement, duplicate rejection and wall collision',()=>{
  const {room}=run();const p=room.players.a!,w=room.world!;w.enemies=[];
  const start=p.x;
  for(let seq=1;seq<=120;seq++){const input={seq,revision:room.revision,x:1,y:0,aimX:1000,aimY:p.y,fire:false,dash:seq===15,light:false};assert.ok(receiveInput(room,p,input,seq*34));assert.equal(receiveInput(room,p,input,seq*34),false);stepRoom(room,seq*34);assert.ok(clear(w.map.grid,p.x,p.y,11,w.doors));}
  assert.ok(p.x>start+140);assert.equal(p.lastSeq,120);
  const x=p.x;for(let i=0;i<60;i++)stepRoom(room,5000+i*34);assert.equal(p.x,x);
});
test('menus cannot pause a party; movement cannot spoof health or position',()=>{
  const {room}=run(),p=room.players.a!,hp=p.hp;
  assert.match(action(room,p,{type:'pause'}),/party/);assert.equal(room.paused,false);
  assert.equal(receiveInput(room,p,{x:99999,y:99999,hp:99999},1),false);assert.equal(p.hp,hp);
  const before=room.world!.time;stepRoom(room);assert.ok(room.world!.time>before);
});
test('cooperative trading is atomic and cannot debit other players',()=>{
  const {room}=run(),a=room.players.a!,b=room.players.b!;a.gold=5;b.x=a.x;b.y=a.y;
  assert.equal(action(room,a,{type:'trade',target:'b',kind:'gold',amount:3}),'');assert.equal(a.gold,2);assert.equal(b.gold,3);
  assert.notEqual(action(room,a,{type:'trade',target:'b',kind:'gold',amount:3}),'');assert.notEqual(action(room,a,{type:'trade',target:'b',kind:'gold',amount:-1}),'');assert.equal(b.gold,3);
});
test('chest rewards and doors have one authoritative transaction',()=>{
  const {room}=run(),w=room.world!,a=room.players.a!,b=room.players.b!,c=w.chests[0]!;
  w.chests=[c];w.map.features=[];
  a.x=b.x=c.x;a.y=b.y=c.y;a.gold=b.gold=100;
  assert.equal(action(room,a,{type:'interact'}),'');const spent=a.gold;
  action(room,b,{type:'interact'});assert.equal(w.chestsOpened,1);assert.equal(a.gold,spent);assert.equal(b.gold,100);
});
test('revives, potions, pings and relic offers validate on server',()=>{
  const {room}=run(),a=room.players.a!,b=room.players.b!;b.downed=true;b.hp=0;Object.assign(b,{x:a.x,y:a.y});
  for(let i=0;i<3;i++)action(room,a,{type:'interact'});assert.equal(b.downed,false);assert.ok(b.hp>0);
  assert.notEqual(action(room,a,{type:'relic',id:'crown'}),'');a.choices=['crown'];assert.equal(action(room,a,{type:'relic',id:'crown'}),'');assert.equal(a.items.crown,1);
  action(room,a,{type:'ping',x:a.x,y:a.y});assert.equal(room.world!.pings.length,1);
});
test('duel winner scores once, rotates and clears upgrades',()=>{
  const {room}=run('duel');room.players.a!.upgrades.triple=3;room.players.b!.downed=true;room.players.b!.hp=0;
  stepRoom(room);assert.equal(room.players.a!.score,1);
  for(let i=0;i<125;i++)stepRoom(room);assert.equal(room.round,2);assert.deepEqual(room.players.a!.upgrades,{});assert.equal(room.players.b!.hp,100);
});
test('waves advances, stage changes after five waves, and quickplay starts',()=>{
  const {room}=run('waves');room.world!.wave=5;room.world!.enemies=[];
  stepRoom(room);for(let i=0;i<125;i++)stepRoom(room);assert.equal(room.stage,2);assert.equal(room.world!.wave,6);
  const store=new RoomStore();const quick=store.join('x',{mode:'waves',name:'X',quickplay:true});assert.equal(quick.status,'playing');
});
test('generated maps have connected required objectives over many seeds',()=>{
  for(const biome of Object.keys(biomes) as Biome[])for(let seed=1;seed<=20;seed++){
    const a=generateMap(seed,1,'dungeon',biome),b=generateMap(seed,2,'dungeon',biome);validateMap(a);validateMap(b);assert.notDeepEqual(a.grid,b.grid);
  }
  assert.equal(duelArenas.length,14);assert.equal(wavesArenas.length,14);
  assert.equal(new Set(Array.from({length:14},(_,i)=>JSON.stringify(generateMap(12,1,'duel','moss',i).grid))).size,14);
  for(let i=0;i<14;i++){const map=generateMap(12,1,'duel','moss',i);for(const p of map.spawns)assert.ok(clear(map.grid,p.x,p.y));}
});
test('projectiles damage rivals but not cooperative teammates',()=>{
  for(const mode of ['duel','dungeon'] as const){
    const {room}=run(mode),w=room.world!,a=room.players.a!,b=room.players.b!;
    w.enemies=[];a.x=140;a.y=220;b.x=200;b.y=220;b.inv=0;
    const hp=b.hp;
    w.bullets.push({id:99,owner:a.id,x:190,y:220,vx:300,vy:0,damage:20,color:'#ffffff',life:1,r:4,pierce:1,hit:[],hostile:false,fire:0,poison:0,ice:0,chain:0,bounces:0});
    stepRoom(room);
    assert.equal(b.hp,mode==='duel'?hp-20:hp);
  }
});
test('map changes discard old-stage commands and keep spawns outside walls',()=>{
  const {room}=run(),old=room.revision,p=room.players.a!;
  room.stage++;loadWorld(room);
  assert.equal(receiveInput(room,p,{seq:1,revision:old,x:1,y:0,aimX:1000,aimY:0},1),false);
  for(const player of Object.values(room.players))assert.ok(clear(room.world!.map.grid,player.x,player.y,11,room.world!.doors));
});
