import express from 'express';
import helmet from 'helmet';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { Server } from 'socket.io';
import { RoomStore } from './rooms.js';
import { action,receiveInput,stepRoom } from './simulation.js';
import { validateMap,type GameMap } from './maps.js';
import { PROTOCOL,TICK } from '../shared/movement.js';
import type { JoinRequest,RoomState } from './types.js';
const app=express(),http=createServer(app);
const allowed=process.env.PUBLIC_ORIGIN?.split(',').map(s=>s.trim()).filter(Boolean);
const io=new Server(http,{cors:{origin:allowed?.length?allowed:true},maxHttpBufferSize:200000});
const rooms=new RoomStore(),maps=new Map<string,{map:GameMap;idleSince:number;owner:string}>();
const build=process.env.RAILWAY_GIT_COMMIT_SHA||'local-v1.2.5';
app.use(helmet({contentSecurityPolicy:false}));
app.get('/api/health',(_q,r)=>r.json({ok:true,protocol:PROTOCOL,build,version:'1.2.5',rooms:rooms.rooms.size}));
app.use(express.static(resolve('dist/public'),{maxAge:0}));
app.get('/',(_q,r)=>r.sendFile(resolve('dist/public/index.html')));
function snapshot(r:RoomState,includeMap=false){
  const players=Object.fromEntries(Object.entries(r.players).map(([id,p])=>{const {queue,input,inputAt,lastReceived,...visible}=p;return [id,visible];}));
  const w=r.world;
  return {protocol:PROTOCOL,build,code:r.code,mode:r.mode,status:r.status,hostId:r.hostId,stage:r.stage,maxStages:r.maxStages,arenaIndex:r.arenaIndex,round:r.round,tick:r.tick,revision:r.revision,paused:r.paused,players,world:w?{...w,features:w.map.features,map:includeMap?w.map:undefined}:undefined};
}
function emit(r:RoomState,full=false){io.to(r.code).emit('room:state',snapshot(r,full));}
type Ack=(v:unknown)=>void;
const callback=(raw:unknown,ack?:Ack):Ack|undefined=>typeof raw==='function'?raw as Ack:typeof ack==='function'?ack:undefined;
io.on('connection',socket=>{
  socket.emit('server:hello',{protocol:PROTOCOL,build,version:'1.2.5'});
  const fail=(ack:Ack|undefined,error:unknown)=>ack?.({ok:false,error:error instanceof Error?error.message:String(error)});
  socket.on('room:join',(raw:JoinRequest,ack?:Ack)=>{try{
    if(raw?.protocol!==PROTOCOL)throw Error('Game update required. Reload to use multiplayer v1.2.5.');
    const r=rooms.join(socket.id,raw);socket.join(r.code);ack?.({ok:true,code:r.code,playerId:socket.id,room:snapshot(r,true)});emit(r,true);
  }catch(e){fail(ack,e);}});
  socket.on('room:start',(raw:{map?:unknown;mapId?:string},ack?:Ack)=>{try{
    const r=rooms.findByPlayer(socket.id);if(!r||r.hostId!==socket.id)throw Error('Only the host can start');
    if(raw?.map)r.customMap=validateMap(raw.map);
    if(raw?.mapId){const published=maps.get(raw.mapId);if(!published)throw Error('Published map expired');r.customMap=structuredClone(published.map);r.mapId=raw.mapId;}
    rooms.start(r,socket.id);emit(r,true);ack?.({ok:true});
  }catch(e){fail(ack,e);}});
  socket.on('player:input',(raw:unknown)=>{const r=rooms.findByPlayer(socket.id),p=r?.players[socket.id];if(r&&p)receiveInput(r,p,raw,Date.now());});
  let lastAction=0;
  socket.on('player:action',(raw:unknown,ack?:Ack)=>{const r=rooms.findByPlayer(socket.id),p=r?.players[socket.id];if(!r||!p)return fail(ack,'Join a run');const now=Date.now(),type=raw&&typeof raw==='object'?String((raw as {type?:unknown}).type):'';if(type!=='relic'&&now-lastAction<150)return fail(ack,'Please wait');if(type!=='relic')lastAction=now;const error=action(r,p,raw);ack?.(error?{ok:false,error}:{ok:true});});
  socket.on('room:sync',(raw:unknown,ack?:Ack)=>{const done=callback(raw,ack),r=rooms.findByPlayer(socket.id);if(r)done?.({ok:true,room:snapshot(r,true)});else done?.({ok:false,error:'Join a room first'});});
  socket.on('room:leave',(raw:unknown,ack?:Ack)=>{const done=callback(raw,ack),r=rooms.leave(socket.id);if(r){socket.leave(r.code);if(rooms.rooms.has(r.code))emit(r);}done?.({ok:true});});
  socket.on('latency',(_value:unknown,ack?:Ack)=>{ack?.({ok:true});});
  const latencyTimer=setInterval(()=>{const start=performance.now();socket.timeout(2000).emit('latency:probe',(err:Error|null)=>{const r=rooms.findByPlayer(socket.id),p=r?.players[socket.id];if(!err&&p)p.latency=Math.min(300,performance.now()-start);});},2000);
  socket.on('maps:list',(raw:unknown,ack?:Ack)=>callback(raw,ack)?.({ok:true,maps:[...maps].map(([id,m])=>({id,name:m.map.name,idleSince:m.idleSince}))}));
  socket.on('maps:publish',(raw:unknown,ack?:Ack)=>{try{if(maps.size>=500)throw Error('Map pool full');const map=validateMap(raw),id=crypto.randomUUID();maps.set(id,{map,idleSince:Date.now(),owner:socket.id});ack?.({ok:true,id});}catch(e){fail(ack,e);}});
  socket.on('disconnect',()=>{clearInterval(latencyTimer);const r=rooms.leave(socket.id);if(r&&rooms.rooms.has(r.code))emit(r);});
});
let last=performance.now(),acc=0;
const timer=setInterval(()=>{
  const now=performance.now();acc=Math.min(.25,acc+(now-last)/1000);last=now;
  while(acc>=TICK){acc-=TICK;for(const r of rooms.rooms.values()){const rev=r.revision;stepRoom(r);if(r.tick%2===0||r.revision!==rev)emit(r,r.revision!==rev);}}
  const wall=Date.now();for(const [id,m]of maps){if([...rooms.rooms.values()].some(r=>r.mapId===id&&Object.keys(r.players).length))m.idleSince=wall;else if(wall-m.idleSince>=3600000)maps.delete(id);}
},1000/30).unref();
const port=Number(process.env.PORT||8000),host=process.env.HOST||'127.0.0.1';
http.listen(port,host,()=>console.log('One More Relic 1.2.5 protocol '+PROTOCOL+' at http://'+host+':'+port+' build '+build));
http.on('close',()=>clearInterval(timer));
export {http,io,rooms,snapshot};
