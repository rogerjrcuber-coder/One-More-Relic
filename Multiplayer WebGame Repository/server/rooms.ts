import type { JoinRequest, Mode, PlayerState, RoomState } from './types.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LIMITS: Record<Mode, number> = { dungeon: 8, duel: 4 };

export class RoomStore {
  readonly rooms = new Map<string, RoomState>();

  private code(): string {
    for (let attempt = 0; attempt < 100; attempt++) {
      let code = '';
      for (let i = 0; i < 5; i++) code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
      if (!this.rooms.has(code)) return code;
    }
    throw new Error('Could not allocate a room code');
  }

  join(socketId: string, request: JoinRequest): RoomState {
    const name = request.name.trim().slice(0, 20) || 'Wanderer';
    let room: RoomState | undefined;
    if (request.code) room = this.rooms.get(request.code.toUpperCase());
    if (!room && request.quickplay) {
      room = [...this.rooms.values()]
        .filter(r => r.mode === request.mode && r.public && r.status !== 'results' && Object.keys(r.players).length < LIMITS[r.mode])
        .sort((a, b) => Object.keys(b.players).length - Object.keys(a.players).length || b.lastActiveAt - a.lastActiveAt)[0];
    }
    if (!room) room = this.create(socketId, request.mode, request.quickplay ?? false);
    if (room.mode !== request.mode) throw new Error('That room is playing a different mode');
    if (Object.keys(room.players).length >= LIMITS[room.mode]) throw new Error('That room is full');
    const maxHp = room.mode === 'duel' ? 100 : 100;
    const player: PlayerState = { id: socketId, name, skin: request.skin || 'moss', ready: false, x: 140, y: 220, hp: maxHp, maxHp, score: 0, connected: true };
    room.players[socketId] = player;
    room.lastActiveAt = Date.now();
    return room;
  }

  create(hostId: string, mode: Mode, isPublic: boolean): RoomState {
    const room: RoomState = { code: this.code(), mode, status: 'lobby', public: isPublic, hostId, createdAt: Date.now(), lastActiveAt: Date.now(), stage: 1, maxStages: mode === 'dungeon' ? 2 : 1, arenaIndex: 0, round: 1, players: {} };
    this.rooms.set(room.code, room);
    return room;
  }

  findByPlayer(socketId: string): RoomState | undefined {
    return [...this.rooms.values()].find(r => r.players[socketId]);
  }

  leave(socketId: string): RoomState | undefined {
    const room = this.findByPlayer(socketId);
    if (!room) return;
    delete room.players[socketId];
    room.lastActiveAt = Date.now();
    const ids = Object.keys(room.players);
    if (!ids.length) this.rooms.delete(room.code);
    else if (room.hostId === socketId) room.hostId = ids[0]!;
    return room;
  }

  start(room: RoomState, socketId: string): void {
    if (room.hostId !== socketId) throw new Error('Only the host can start');
    if (room.mode === 'duel' && Object.keys(room.players).length < 2) throw new Error('Duels need at least two players');
    room.status = 'playing';
    room.stage = 1;
    room.round = 1;
    const entrance = room.mapGrid?.flatMap((row, y) => row.map((tile, x) => tile === 2 ? { x: x * 40 + 20, y: y * 40 + 20 } : null)).find((point): point is { x: number; y: number } => point !== null) || { x: 120, y: 180 };
    room.players = Object.fromEntries(Object.entries(room.players).map(([id, p], index) => [id, { ...p, hp: p.maxHp, x: entrance.x + index * 28, y: entrance.y, ready: false, lastInputAt: undefined }]));
    room.lastActiveAt = Date.now();
  }

  advance(room: RoomState): void {
    if (room.mode === 'dungeon') {
      if (room.stage < room.maxStages) room.stage++;
      else room.status = 'results';
    } else {
      room.round++;
      room.arenaIndex = (room.arenaIndex + 1) % 10;
      for (const p of Object.values(room.players)) { p.hp = p.maxHp; p.x = 120; p.y = 180; }
    }
    room.lastActiveAt = Date.now();
  }

  cleanup(now = Date.now()): string[] {
    const removed: string[] = [];
    for (const [code, room] of this.rooms) {
      if (!Object.keys(room.players).length && now - room.lastActiveAt >= 3_600_000) { this.rooms.delete(code); removed.push(code); }
    }
    return removed;
  }
}
