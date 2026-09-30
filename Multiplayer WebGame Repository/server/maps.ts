import { biomes, duelArenas, wavesArenas, events, type Biome } from './content.js';
import { clear, type Point } from '../shared/movement.js';
export interface Feature extends Point { id: string; kind: string; open?: boolean; active?: boolean; value?: number; target?: Point }
export interface GameMap {
  id:string; name:string; seed:number; biome:Biome; grid:number[][]; stageCount:number;
  lighting:string; event:string; modules:{kind:string;x:number;y:number;variant:number}[];
  features:Feature[]; spawns:Point[]; exit:Point; chestPricing:{baseCost:number;increase:number};
  creatures:Record<string,Record<string,unknown>>;
}
export function random(seed:number):()=>number { let n=seed>>>0;return ()=>{n+=0x6D2B79F5;let t=n;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;}; }
const center=(x:number,y:number)=>({x:x*40+20,y:y*40+20});
const roomKinds=['combat','crossroads','treasure','dark','puzzle','vault','antechamber','secret','key','merchant'];
// Reusable room decorators; the connector skeleton is carved after decoration.
export const modules = [
  {name:'pillars',decorate:(g:number[][],x:number,y:number)=>{for(const [dx,dy] of [[2,2],[6,2],[2,6],[6,6]])g[y+dy!]![x+dx!]=1;}},
  {name:'divided',decorate:(g:number[][],x:number,y:number)=>{for(let d=2;d<7;d++)if(d!==4)g[y+2]![x+d]=1;}},
  {name:'alcoves',decorate:(g:number[][],x:number,y:number)=>{g[y+2]![x+2]=1;g[y+6]![x+6]=1;}},
  {name:'open',decorate:(_g:number[][],_x:number,_y:number)=>{}}
];
export function generateMap(seed:number,stage:number,mode:'dungeon'|'waves'|'duel',selected:Biome='moss',arena=0):GameMap {
  const rng=random(seed+stage*7919+arena*104729),pick=<T>(a:readonly T[])=>a[Math.floor(rng()*a.length)]!;
  const config=mode==='duel'?duelArenas[arena%duelArenas.length]:mode==='waves'?wavesArenas[arena%wavesArenas.length]:undefined;
  const biome:Biome=config?.biome||selected,theme=biomes[biome];
  const grid=Array.from({length:mode==='dungeon'?41:29},()=>Array<number>(mode==='dungeon'?51:37).fill(1));
  const features:Feature[]=[],placed:GameMap['modules']=[];
  const carve=(x:number,y:number,w:number,h:number)=>{for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)grid[yy]![xx]=0;};
  const feature=(x:number,y:number,kind:string,value?:number,target?:Point)=>features.push({id:`f${features.length}`,kind,...center(x,y),value,target,active:true});
  let spawns:Point[],exit:Point;
  if(mode==='dungeon') {
    // A connected 5x4 room graph: main spine, loops, optional reward wings.
    for(let ry=0;ry<4;ry++)for(let rx=0;rx<5;rx++) {
      const x=rx*10+1,y=ry*10+1,variant=Math.floor(rng()*modules.length),kind=pick(roomKinds);
      carve(x,y,9,9);modules[variant]!.decorate(grid,x,y);placed.push({kind,x,y,variant});
      if(rx<4)carve(x+8,y+3,3,3);if(ry<3)carve(x+3,y+8,3,3);
      grid[y+4]![x+4]=ry===0&&rx===0?2:4;
      grid[y+6]![x+4]=pick([5,8,6,9]);
      feature(x+6,y+4,theme.hazard);
      if(kind==='dark')feature(x+4,y+4,'darkness');
      if(kind==='treasure')grid[y+4]![x+6]=5;
      if(kind==='merchant')feature(x+4,y+6,'merchant',8);
    }
    // Every expedition needs at least one early upgrade choice, independent of
    // the random room labels and the optional vault wing.
    grid[7]![5]=5;
    // Key-gated optional room: close both connectors, then place key before gate.
    for(let y=1;y<=9;y++)grid[y]![40]=1;
    for(let x=41;x<=49;x++)grid[10]![x]=1;
    grid[5]![40]=10;grid[5]![35]=9;grid[5]![45]=11;
    // Optional vault module has a genuine spawn chance, not just different loot.
    if(rng()>=.4){for(let y=1;y<=9;y++)for(let x=41;x<=49;x++)grid[y]![x]=1;grid[5]![40]=1;}
    // A secret passage with a discoverable switch and a generous reward.
    if(rng()<.4){feature(15,35,'secret');grid[35]![15]=11;feature(13,35,'switch');}
    // Guaranteed distinct stage orientation while keeping objectives connected.
    const ex=stage%2===0?5:45,ey=35;
    grid[ey]![ex]=3;grid[ey-2]![ex]=7;grid[ey]![ex-2]=8;
    spawns=[center(5,5)];exit=center(ex,ey);
  } else {
    carve(1,1,35,27);
    const shape=config!.shape,c=config!.cover;
    for(let i=0;i<c;i++) {
      const x=6+i*3,y=6+(i%3)*5;
      if(shape==='cross'||shape==='fort'){grid[y]![x]=1;grid[28-y]![36-x]=1;grid[y]![36-x]=1;grid[28-y]![x]=1;}
      if(shape==='lanes')for(let yy=5;yy<24;yy++)if(yy%7>2){grid[yy]![10+i*3]=1;grid[yy]![26-i*3]=1;}
      if(shape==='ring')for(let xx=10+i;xx<27-i;xx++)if(xx%5>1){grid[6+i]![xx]=1;grid[22-i]![xx]=1;}
      if(shape==='open'){grid[y]![x]=1;grid[28-y]![36-x]=1;}
    }
    // Symmetric optional cover, safe spawn corridors, and traversal pairs.
    if(rng()<.5){grid[7]![17]=1;grid[21]![19]=1;}
    for(const y of [3,14,25])carve(2,y,33,1);
    for(const x of [3,18,33])carve(x,2,1,25);
    if(shape==='fort')for(let x=13;x<=23;x++)if(x!==18){grid[11]![x]=1;grid[17]![x]=1;}
    spawns=[center(3,3),center(33,25),center(33,3),center(3,25)];exit=center(18,14);
    feature(18,9,theme.hazard);feature(18,19,theme.hazard);
    feature(3,14,'lift',undefined,center(33,14));feature(33,14,'lift',undefined,center(3,14));
    if(rng()<.5){feature(18,6,'bridge');feature(18,22,'bridge');}
    for(const [x,y]of [[8,8],[28,20],[8,20],[28,8]])grid[y!]![x!]=8;
    grid[3]![3]=2;
    placed.push({kind:shape,x:1,y:1,variant:arena});
  }
  const event=pick(events);
  if(event==='Double keys')for(const row of grid)for(let x=0;x<row.length;x++)if(row[x]===5)row[x]=9;
  if(event==='Treasure')for(let y=2;y<grid.length-2;y+=10)if(grid[y]![5]===0)grid[y]![5]=5;
  if(event==='Wandering merchant')feature(6,5,'merchant',6);
  if(biome==='forge'){feature(8,5,'platform');feature(9,5,'lava');feature(10,5,'lava');}
  if(biome==='crystal'){feature(mode==='dungeon'?39:15,5,'crystal');feature(mode==='dungeon'?40:15,mode==='dungeon'?5:6,'hidden-path');}
  if(biome==='sunken')feature(15,5,'submerged-vault');
  if(biome==='gardens')feature(15,5,'living-root');
  const suffix=['Outskirts','Inner Sanctum','Throne Depths'][(stage-1)%3];
  return {id:`${mode}-${seed}-${stage}-${arena}`,name:config?.name||`${theme.name} / ${suffix}`,seed,biome,grid,stageCount:3,lighting:event==='Darkness'?'dark':biome==='crystal'?'bright':'gloom',event,modules:placed,features,spawns,exit,chestPricing:{baseCost:3,increase:2},creatures:{}};
}
export function validateMap(raw:unknown):GameMap {
  if(!raw||typeof raw!=='object')throw Error('Invalid map');
  const m=raw as Partial<GameMap>,g=m.grid;
  if(!Array.isArray(g)||g.length<16||g.length>44||!g[0]||g[0].length<20||g[0].length>64||!g.every(row=>Array.isArray(row)&&row.length===g[0]!.length&&row.every(t=>Number.isInteger(t)&&t>=0&&t<=11)))throw Error('Invalid grid');
  const points=(tile:number)=>g.flatMap((row,y)=>row.flatMap((t,x)=>t===tile?[center(x,y)]:[]));
  if(points(2).length!==1||points(3).length!==1||points(7).length!==1)throw Error('Map needs one entrance, exit and boss');
  const spawn=points(2)[0]!,seen=new Set<string>(),queue=[spawn];
  while(queue.length){const p=queue.shift()!,x=Math.floor(p.x/40),y=Math.floor(p.y/40),key=`${x},${y}`;if(seen.has(key)||!clear(g,p.x,p.y))continue;seen.add(key);for(const [dx,dy]of [[40,0],[-40,0],[0,40],[0,-40]])queue.push({x:p.x+dx!,y:p.y+dy!});}
  for(let y=0;y<g.length;y++)for(let x=0;x<g[0]!.length;x++)if(g[y]![x]!>1&&!seen.has(`${x},${y}`))throw Error('Connect all map objectives');
  if(points(10).length>points(9).length)throw Error('Place enough keys for doors');
  return {id:'custom',name:String(m.name||'Custom dungeon').slice(0,40),seed:0,biome:'moss',grid:g.map(r=>r.slice()),stageCount:Math.max(2,Math.min(5,Math.round(Number(m.stageCount)||2))),lighting:['gloom','bright','dark'].includes(String(m.lighting))?m.lighting!:'gloom',event:'Authored expedition',modules:[],features:[],spawns:[spawn],exit:points(3)[0]!,chestPricing:{baseCost:Math.max(0,Math.min(100,Number(m.chestPricing?.baseCost)||0)),increase:Math.max(0,Math.min(100,Number(m.chestPricing?.increase)||0))},creatures:m.creatures&&typeof m.creatures==='object'?m.creatures:{}};
}
