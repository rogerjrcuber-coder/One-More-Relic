import assert from 'node:assert/strict';
import test from 'node:test';
import { RoomStore } from './rooms.js';

test('quickplay fills active rooms up to mode limit', () => {
  const store = new RoomStore();
  const first = store.join('a', { mode: 'dungeon', name: 'A', quickplay: true });
  const second = store.join('b', { mode: 'dungeon', name: 'B', quickplay: true });
  assert.equal(first.code, second.code);
  assert.equal(Object.keys(first.players).length, 2);
});

test('duel rotation preserves players and resets round state', () => {
  const store = new RoomStore();
  const room = store.join('a', { mode: 'duel', name: 'A' });
  store.join('b', { code: room.code, mode: 'duel', name: 'B' });
  store.start(room, 'a');
  room.players.a!.score = 3;
  store.advance(room);
  assert.equal(room.round, 2);
  assert.equal(room.arenaIndex, 1);
  assert.equal(room.players.a!.score, 3);
  assert.equal(room.players.a!.hp, 100);
});
