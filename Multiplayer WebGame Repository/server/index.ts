import express from 'express';
import helmet from 'helmet';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { Server } from 'socket.io';
import { RoomStore } from './rooms.js';
import type { JoinRequest } from './types.js';

const app = express();
const http = createServer(app);
const io = new Server(http, { cors: { origin: process.env.PUBLIC_ORIGIN || true }, maxHttpBufferSize: 1_000_000 });
const rooms = new RoomStore();
const publicDir = resolve(process.cwd(), 'dist/public');

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '200kb' }));
app.get('/api/health', (_req, res) => res.json({ ok: true, rooms: rooms.rooms.size }));
app.get('/api/rooms', (_req, res) => res.json([...rooms.rooms.values()].filter(r => r.public).map(r => ({ code: r.code, mode: r.mode, players: Object.keys(r.players).length, status: r.status }))));
app.use(express.static(publicDir, { etag: true, maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0 }));
app.get('*path', (_req, res) => res.sendFile(resolve(publicDir, 'index.html')));

const emitRoom = (code: string) => {
  const room = rooms.rooms.get(code);
  if (room) io.to(code).emit('room:state', room);
};

io.on('connection', socket => {
  socket.on('room:join', (raw: JoinRequest, ack?: (value: unknown) => void) => {
    try {
      if (!raw || !['dungeon', 'duel'].includes(raw.mode)) throw new Error('Invalid mode');
      const room = rooms.join(socket.id, raw);
      socket.join(room.code);
      ack?.({ ok: true, code: room.code, playerId: socket.id });
      emitRoom(room.code);
    } catch (error) { ack?.({ ok: false, error: error instanceof Error ? error.message : 'Could not join' }); }
  });
  socket.on('room:start', (ack?: (value: unknown) => void) => {
    try { const room = rooms.findByPlayer(socket.id); if (!room) throw new Error('Join a room first'); rooms.start(room, socket.id); emitRoom(room.code); ack?.({ ok: true }); }
    catch (error) { ack?.({ ok: false, error: error instanceof Error ? error.message : 'Could not start' }); }
  });
  socket.on('player:input', (input: { x?: number; y?: number }) => {
    const room = rooms.findByPlayer(socket.id), player = room?.players[socket.id];
    if (!room || !player || room.status !== 'playing') return;
    const x = Number(input?.x), y = Number(input?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const length = Math.hypot(x, y) || 1, speed = 4;
    player.x = Math.max(0, Math.min(1920, player.x + x / Math.max(1, length) * speed));
    player.y = Math.max(0, Math.min(1360, player.y + y / Math.max(1, length) * speed));
    room.lastActiveAt = Date.now();
  });
  socket.on('stage:advance', () => { const room = rooms.findByPlayer(socket.id); if (room?.hostId === socket.id) { rooms.advance(room); emitRoom(room.code); } });
  socket.on('disconnect', () => { const room = rooms.leave(socket.id); if (room && rooms.rooms.has(room.code)) emitRoom(room.code); });
});

setInterval(() => {
  rooms.cleanup();
  for (const room of rooms.rooms.values()) if (room.status === 'playing') emitRoom(room.code);
}, 50).unref();

const port = Number(process.env.PORT || 8000), host = process.env.HOST || '127.0.0.1';
http.listen(port, host, () => console.log(`One More Relic v1.1 at http://${host}:${port}`));

export { http, io, rooms };
