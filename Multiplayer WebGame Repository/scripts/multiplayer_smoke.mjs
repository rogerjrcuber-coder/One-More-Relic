import assert from 'node:assert/strict';
import { io } from 'socket.io-client';

const endpoint = process.env.OMR_TEST_URL || 'http://127.0.0.1:8000';
const connect = () => new Promise((resolve, reject) => {
  const socket = io(endpoint, { transports: ['websocket'], forceNew: true, timeout: 3000 });
  socket.once('connect', () => resolve(socket));
  socket.once('connect_error', reject);
});
const emitAck = (socket, event, payload) => new Promise(resolve => payload === undefined ? socket.emit(event, resolve) : socket.emit(event, payload, resolve));
const stateWhere = (socket, predicate) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => { socket.off('room:state', receive); reject(new Error('Timed out waiting for room state')); }, 4000);
  const receive = state => { if (!predicate(state)) return; clearTimeout(timer); socket.off('room:state', receive); resolve(state); };
  socket.on('room:state', receive);
});

const host = await connect(), guest = await connect();
try {
  const joinedHost = await emitAck(host, 'room:join', { mode: 'dungeon', name: 'Host', skin: 'moss' });
  assert.equal(joinedHost.ok, true);
  const both = stateWhere(host, room => Object.keys(room.players).length === 2);
  const joinedGuest = await emitAck(guest, 'room:join', { mode: 'dungeon', name: 'Guest', code: joinedHost.code, skin: 'frost' });
  assert.equal(joinedGuest.ok, true);
  assert.equal((await both).code, joinedHost.code);
  const playing = stateWhere(guest, room => room.status === 'playing');
  assert.equal((await emitAck(host, 'room:start')).ok, true);
  const started = await playing;
  const before = started.players[joinedHost.playerId].x;
  const moved = stateWhere(guest, room => room.players[joinedHost.playerId].x > before);
  host.emit('player:input', { x: 1, y: 0 });
  assert.ok((await moved).players[joinedHost.playerId].x > before);
  console.log(`PASS: two clients joined ${joinedHost.code}, started together, and received synchronized movement`);
} finally {
  host.disconnect(); guest.disconnect();
}
