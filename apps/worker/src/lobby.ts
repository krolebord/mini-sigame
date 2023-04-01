import { SingleReplica, SingleSocketEvent } from '@tic/dog';
import { z } from 'zod';

type LobbyInfo = {
  player1: string;
  player2: string;
};

type Cell = 'x' | 'o' | null;
type Row = [Cell, Cell, Cell]
type Board = [Row, Row, Row];

export type GameState = GameStatePayload['type'];

export type GameStatePayload =
  | {
    type: 'lobby';
    lobby: Partial<LobbyInfo>;
  }
  | {
    type: 'lobby:choose-sides';
    lobby: LobbyInfo,
    firstTurn: 'player1' | 'player2';
    player1Ready: boolean;
    player2Ready: boolean;
  }
  | {
    type: 'game';
    lobby: LobbyInfo;
    fistTurn: 'player1' | 'player2';
    turn: number;
    board: Board;
  }
  | {
    type: 'game:over';
    lobby: LobbyInfo;
    winner: 'player1' | 'player2' | 'draw';
    board: Board;
  };

export type Message = z.infer<typeof messageSchema>;
export type MessageType = Message['type'];

type ExtractMessage<T extends MessageType> = Extract<Message, { type: T }>;

type MessageHandlers = {
  [K in MessageType]: (event: SingleSocketEvent, data: ExtractMessage<K>) => Promise<void>;
}

const messageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('lobby:switch-sides'),
  }),
  z.object({
    type: z.literal('lobby:ready'),
  }),
  z.object({
    type: z.literal('lobby:unready'),
  }),
  z.object({
    type: z.literal('game:move'),
    x: z.number().int().min(0).max(2),
    y: z.number().int().min(0).max(2),
  }),
])

function createBoard(): Board {
  return [
    [null, null, null],
    [null, null, null],
    [null, null, null],
  ];
}

export class TicTacToeLobby extends SingleReplica {
  public maxUsers: number = 2;

  private gameState: GameStatePayload = {
    type: 'lobby',
    lobby: {},
  };

  private readonly handlers: Partial<MessageHandlers> = {
    "lobby:switch-sides": async (event, data) => {
      if (this.gameState.type !== 'lobby:choose-sides') {
        return;
      }

      this.gameState.firstTurn = this.gameState.firstTurn === 'player2' ? 'player1' : 'player2';

      this.boradcastState();
    },
    "lobby:ready": async (event, data) => {
      if (this.gameState.type !== 'lobby:choose-sides') {
        return;
      }

      const { player1, player2 } = this.gameState.lobby;
      if (event.rid === player1) {
        this.gameState.player1Ready = true;
      } else if (event.rid === player2) {
        this.gameState.player2Ready = true;
      }

      if (this.gameState.player1Ready && this.gameState.player2Ready) {
        this.gameState = {
          type: 'game',
          fistTurn: this.gameState.firstTurn,
          turn: 0,
          lobby: this.gameState.lobby,
          board: createBoard(),
        };
      }

      this.boradcastState();
    },
    "lobby:unready": async (event, data) => {
      if (this.gameState.type !== 'lobby:choose-sides') {
        return;
      }

      const { player1, player2 } = this.gameState.lobby;
      if (event.rid === player1) {
        this.gameState.player1Ready = false;
      } else if (event.rid === player2) {
        this.gameState.player2Ready = false;
      }

      this.boradcastState();
    },
    "game:move": async (event, data) => {
      if (this.gameState.type !== 'game') {
        return;
      }

      const { player1 } = this.gameState.lobby;
      const currentPlayer = event.rid === player1 ? 'player1' : 'player2';

      const turnOrder = this.gameState.fistTurn === 'player1'
        ? ['player1', 'player2']
        : ['player2', 'player1'];
      const playerTurn = turnOrder[this.gameState.turn % 2];

      if (currentPlayer !== playerTurn) {
        return;
      }

      const { x, y } = data;
      const cell = (['x', 'o'] as const)[this.gameState.turn % 2];

      if (this.gameState.board[y][x] !== null) {
        return;
      }

      this.gameState.board[y][x] = cell;
      this.gameState.turn++;

      const winner = checkWinner(this.gameState.board);

      if (winner) {
        this.gameState = {
          type: 'game:over',
          winner: currentPlayer,
          lobby: this.gameState.lobby,
          board: this.gameState.board,
        };
      } else if (this.gameState.turn === 9) {
        this.gameState = {
          type: 'game:over',
          winner: 'draw',
          lobby: this.gameState.lobby,
          board: this.gameState.board,
        };
      }

      this.boradcastState();
    },
  };

  async receive(req: Request) {
    return this.connect(req);
  }

  onopen({ rid, socket }: SingleSocketEvent): void | Promise<void> {
    socket.send(JSON.stringify(this.gameState));

    if (this.gameState.type !== 'lobby') {
      return;
    }

    if (!this.gameState.lobby.player1) {
      this.gameState.lobby.player1 = rid;
      this.boradcastState();
    }
    else if (!this.gameState.lobby.player2 && this.gameState.lobby.player1 !== rid) {
      this.gameState.lobby.player2 = rid;
      this.boradcastState();
    }

    const { player1, player2 } = this.gameState.lobby;
    if (player1 && player2) {
      this.gameState = {
        type: 'lobby:choose-sides',
        firstTurn: 'player1',
        player1Ready: false,
        player2Ready: false,
        lobby: { player1, player2 },
      }
      this.boradcastState();
    }
  }

  onmessage(state: SingleSocketEvent, data: string): void | Promise<void> {
    const parsed = JSON.parse(data);
    const message = messageSchema.safeParse(parsed);

    if (!message.success) {
      return;
    }

    return this.handlers[message.data.type]?.(state, message.data as never);
  }

  private boradcastState() {
    this.broadcast(this.gameState);
  }
}

function checkLine(line: Cell[]) {
  for (let i = 1; i < line.length; i++) {
    if (!line[i - 1] || line[i - 1] !== line[i]) {
      return null;
    }
  }
  return line[0];
}

function* getLines(board: Board): Generator<Cell[]> {
  // rows
  for (let y = 0; y < board.length; y++) {
    yield board[y];
  }

  // columns
  for (let x = 0; x < board[0].length; x++) {
    yield board.map(row => row[x]);
  }

  // diagonals
  yield board.map((row, i) => row[i]);
  yield board.map((row, i) => row[row.length - i - 1]);
}

function checkWinner(board: Board) {
  for (const line of getLines(board)) {
    const winner = checkLine(line);
    if (winner) {
      return winner;
    }
  }
  return null;
}
