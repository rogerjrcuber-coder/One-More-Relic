export type Mode = 'dungeon' | 'duel';
export type RoomStatus = 'lobby' | 'playing' | 'results';

export interface PlayerState {
  id: string;
  name: string;
  skin: string;
  ready: boolean;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  score: number;
  connected: boolean;
}

export interface RoomState {
  code: string;
  mode: Mode;
  status: RoomStatus;
  public: boolean;
  hostId: string;
  createdAt: number;
  lastActiveAt: number;
  stage: number;
  maxStages: number;
  arenaIndex: number;
  round: number;
  players: Record<string, PlayerState>;
}

export interface JoinRequest {
  code?: string;
  mode: Mode;
  name: string;
  skin?: string;
  quickplay?: boolean;
}
