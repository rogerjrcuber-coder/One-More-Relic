import { randomBytes } from 'node:crypto';
import { biomes } from './content.js';
import { newPlayer,loadWorld,spawnPlayer } from './simulation.js';
import type { JoinRequest,Mode,RoomState } from './types.js';
const LIMITS:Record<Mode,number>={dungeon:8,waves:8,duel:4};
export class RoomStore {
  readonly rooms=new Map<string,RoomState>();
  private membership=new Map<string,string>();
  join(id:string,request:JoinRequest):RoomState {
    if(this.membership.has(id))throw Error('Leave your current room first');
    if(!request||!Object.hasOwn(LIMITS,request.mode))throw Error('Invalid mode');
    let room=request.code?this.rooms.get(String(request.code).toUpperCase()):undefined;
    if(request.code&&!room)throw Error('Room not found');
    if(!room&&request.quickplay)room=[...this.rooms.values()].filter(r=>r.public&&r.mode===request.mode&&r.status!=='results'&&Object.keys(r.players).length<LIMITS[r.mode]).sort((a,b)=>Object.keys(b.players).length-Object.keys(a.players).length)[0];
    if(!room)room=this.create(id,request.mode,Boolean(request.quickplay));
    if(room.mode!==request.mode||room.status==='results')throw Error('Room is not available for this mode');
    if(Object.keys(room.players).length>=LIMITS[room.mode])throw Error('Room is full');
    const p=newPlayer(id,String(request.name||'Wanderer').trim().slice(0,20),String(request.skin||'moss').slice(0,20),request.weapon,request.perk);
    room.players[id]=p;this.membership.set(id,room.code);room.lastActiveAt=Date.now();room.paused=false;
    if(room.hostId===id&&request.biome&&Object.hasOwn(biomes,request.biome))room.biome=request.biome;
    if(room.world){spawnPlayer(room,p,Object.keys(room.players).length-1);if(room.mode==='duel')p.downed=true;}
    if(room.public&&room.status==='lobby'&&Object.keys(room.players).length>=2)this.start(room,room.hostId);
    return room;
  }
  create(hostId:string,mode:Mode,isPublic:boolean):RoomState {
    let code;do{code=randomBytes(4).toString('hex').slice(0,5).toUpperCase();}while(this.rooms.has(code));
    const room:RoomState={code,mode,status:'lobby',public:isPublic,hostId,createdAt:Date.now(),lastActiveAt:Date.now(),stage:1,maxStages:3,arenaIndex:0,round:1,players:{},seed:randomBytes(4).readUInt32LE(),biome:'moss',tick:0,revision:0,paused:false};
    this.rooms.set(code,room);return room;
  }
  findByPlayer(id:string):RoomState|undefined {return this.rooms.get(this.membership.get(id)||'');}
  leave(id:string):RoomState|undefined {
    const r=this.findByPlayer(id);if(!r)return;delete r.players[id];this.membership.delete(id);r.lastActiveAt=Date.now();
    const ids=Object.keys(r.players);if(!ids.length)this.rooms.delete(r.code);else if(r.hostId===id)r.hostId=ids[0]!;
    return r;
  }
  start(r:RoomState,id:string):void {
    if(r.hostId!==id)throw Error('Only the host can start');
    if(r.status==='playing')throw Error('Run already started');
    if(r.public&&Object.keys(r.players).length<2)throw Error('Quickplay requires at least two players');
    if(r.mode==='duel'&&Object.keys(r.players).length<2)throw Error('Duels require two players');
    r.stage=1;r.round=1;r.status='playing';r.maxStages=r.customMap?.stageCount||3;loadWorld(r);r.lastActiveAt=Date.now();
  }
  // Kept for internal tools; clients have no stage-advance authority.
  advance(r:RoomState):void {if(r.mode==='duel'){r.round++;r.arenaIndex=(r.arenaIndex+1)%14;}else r.stage++;loadWorld(r);}
  cleanup(now=Date.now()):string[]{const removed:string[]=[];for(const [code,r]of this.rooms)if(!Object.keys(r.players).length&&now-r.lastActiveAt>=3600000){this.rooms.delete(code);removed.push(code);}return removed;}
}
