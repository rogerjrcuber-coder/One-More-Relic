import type { Input, Motion, Point } from '../shared/movement.js';
import type { GameMap } from './maps.js';
import type { Biome } from './content.js';
export type Mode='dungeon'|'waves'|'duel';
export type RoomStatus='lobby'|'playing'|'results';
export interface PlayerState extends Motion {
  id:string;name:string;skin:string;ready:boolean;hp:number;maxHp:number;score:number;connected:boolean;
  weapon:'wand'|'repeater'|'scatter';inv:number;fireCD:number;lantern:number;wideLight:boolean;heat:number;
  gold:number;keys:number;potions:number;items:Record<string,number>;upgrades:Record<string,number>;
  statuses:Record<string,number>;shield:number;shieldTimer:number;attacks:number;hits:number;
  lastSeq:number;latency:number;downed:boolean;revive:number;emote:string;emoteUntil:number;
  choices:string[];input:Input|null;inputAt:number;queue:Input[];lastReceived:number;
}
export interface Enemy extends Motion {
  id:number;name:string;hp:number;maxHp:number;damage:number;speed:number;boss:boolean;elite:boolean;
  behavior:string;color:string;cd:number;flash:number;target:string|null;alert:number;windup:number;
  chargeAngle:number;chargeTime:number;raging:boolean;statuses:Record<string,number>;dead:boolean;animation:string;
}
export interface Projectile extends Point {id:number;owner:string;vx:number;vy:number;damage:number;color:string;life:number;r:number;pierce:number;hit:string[];hostile:boolean;fire:number;poison:number;ice:number;chain:number;bounces:number;}
export interface Pickup extends Point {id:number;kind:'gold'|'key'|'potion'|'upgrade';value:number;upgrade?:string;}
export interface Chest extends Point {id:number;kind:'upgrade'|'vault';opened:boolean;}
export interface World {
  map:GameMap;enemies:Enemy[];bullets:Projectile[];pickups:Pickup[];chests:Chest[];doors:(Point&{id:number;open:boolean})[];
  torches:Point[];traps:Point[];time:number;roundTime:number;wave:number;kills:number;chestsOpened:number;bossDead:boolean;
  message:string;transition:number;winner:string|null;nextId:number;spawnTimer:number;
  pings:(Point&{id:string;owner:string;kind:string;expires:number})[];
}
export interface RoomState {
  code:string;mode:Mode;status:RoomStatus;public:boolean;hostId:string;createdAt:number;lastActiveAt:number;
  stage:number;maxStages:number;arenaIndex:number;round:number;players:Record<string,PlayerState>;
  seed:number;biome:Biome;tick:number;revision:number;world?:World;customMap?:GameMap;mapId?:string;paused:boolean;
}
export interface JoinRequest {code?:string;mode:Mode;name:string;skin?:string;quickplay?:boolean;protocol?:number;weapon?:string;perk?:string;biome?:Biome;}
