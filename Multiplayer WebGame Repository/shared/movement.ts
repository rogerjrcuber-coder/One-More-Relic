// Shared by the server and prediction client. No DOM, clocks, or random state.
export const PROTOCOL = 12;
export const TICK = 1 / 30;
export const TILE = 40;
export interface Point { x: number; y: number }
export interface Body extends Point { r: number }
export interface Blocker extends Point { open: boolean }
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
export function solid(grid: number[][], x: number, y: number, doors: Blocker[] = []): boolean {
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  return !grid[ty] || grid[ty]![tx] === undefined || grid[ty]![tx] === 1 || doors.some(d => !d.open && Math.abs(d.x-x) < 20 && Math.abs(d.y-y) < 20);
}
export function clear(grid: number[][], x: number, y: number, r = 11, doors: Blocker[] = []): boolean {
  return [[-r,-r],[r,-r],[-r,r],[r,r]].every(([dx,dy]) => !solid(grid,x+dx!,y+dy!,doors));
}
export function move(body: Body, dx: number, dy: number, grid: number[][], doors: Blocker[] = []): void {
  const steps = Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/5));
  for(let i=0;i<steps;i++) {
    if(clear(grid,body.x+dx/steps,body.y,body.r,doors)) body.x+=dx/steps;
    if(clear(grid,body.x,body.y+dy/steps,body.r,doors)) body.y+=dy/steps;
  }
}
export function sight(grid: number[][], a: Point, b: Point, doors: Blocker[] = []): boolean {
  const steps=Math.ceil(distance(a,b)/6);
  for(let i=1;i<steps;i++) if(solid(grid,a.x+(b.x-a.x)*i/steps,a.y+(b.y-a.y)*i/steps,doors)) return false;
  return true;
}
export interface Motion extends Body { dash: number; dashCD: number; dashX: number; dashY: number; perk: string; upgrades?: Record<string,number> }
export interface Input { seq: number; revision: number; x: number; y: number; aimX: number; aimY: number; fire: boolean; dash: boolean; light: boolean }
export function movementStep(p: Motion, input: Input, grid: number[][], doors: Blocker[], dt = TICK, slow = 1): void {
  p.dashCD=Math.max(0,p.dashCD-dt);
  const len=Math.max(1,Math.hypot(input.x,input.y));
  let x=input.x/len,y=input.y/len;
  if(input.dash && p.dashCD===0) {
    if(Math.hypot(x,y)<.1) { const a=Math.atan2(input.aimY-p.y,input.aimX-p.x);x=Math.cos(a);y=Math.sin(a); }
    p.dash=.18;p.dashCD=1.4/(1+.2*(p.upgrades?.dash||0));p.dashX=x;p.dashY=y;
  }
  if(p.dash>0) { p.dash=Math.max(0,p.dash-dt);move(p,p.dashX*510*dt,p.dashY*510*dt,grid,doors); }
  else { const speed=155*(p.perk==='swift'?1.15:1)*slow;move(p,x*speed*dt,y*speed*dt,grid,doors); }
}
