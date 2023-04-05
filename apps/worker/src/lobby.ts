import { SingleReplica, SingleSocketEvent } from '@tic/dog';
import { diff } from 'just-diff';
import { DiffOps } from 'just-diff-apply';
import { z } from 'zod';
import { Env } from './env';
import { handleResponse } from './handlers';
import { AnswerNode, getPack, QuestionNode, StoredManifest } from './manifest';

type User = {
  id: string;
  avatar: string;
};

export type HostState = {
  answer?: string;
};

export type GameStateType = GameState['type'];
export type GameState =
  | {
      type: 'not-started';
    }
  | {
      type: 'choose-question';
    }
  | {
      type: 'question';
      nodes: QuestionNode[];
    }
  | {
      type: 'question:timer';
      nodes: QuestionNode[];
      timerStarts: number;
      timerEnds: number;
    }
  | {
      type: 'question:time-stopped';
      nodes: QuestionNode[];
      timerTime: number;
    }
  | {
      type: 'question:answer';
      nodes: AnswerNode[];
    };

export type LobbyState = {
  pack: {
    name: string;
    key: string;
  };
  host: User;
  players: {
    user: User;
    ready: boolean;
    score: number;
  }[];
  round: {
    number: number;
    name: string;
    categories: {
      name: string;
      questions: ({
        price: number;
      } | null)[];
    }[];
  };
  game: GameState;
};

export type Message =
  | {
      type: 'lobby';
      state: LobbyState;
    }
  | {
      type: 'host';
      state: HostState;
    }
  | {
      type: 'patch';
      patch: DiffOps;
    };

export type Action = z.infer<typeof actionSchema>;
export type ActionType = Action['type'];

export type HostActionType = Extract<ActionType, `host:${string}`>;
export type HostAction = Extract<Action, { type: HostActionType }>;

type ActionHandlers = {
  [K in ActionType]: (
    event: SingleSocketEvent,
    data: Extract<Action, { type: K }>
  ) => Promise<void>;
};

const actionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('lobby:ready'),
  }),
  z.object({
    type: z.literal('host:start'),
  }),
]);

export class MiniSigameLobby extends SingleReplica {
  public maxUsers: number = 8;

  private initialized = false;

  private manifest!: StoredManifest;

  private lobbyState!: LobbyState;
  private previousLobbyState!: LobbyState;

  private hostState!: HostState;

  private readonly kv: KVNamespace;

  constructor(private state: DurableObjectState, env: Env) {
    super(state);

    this.kv = env.SIGAME_KV;

    this.state.blockConcurrencyWhile(() =>
      this.initializeLobby().catch(console.error)
    );
  }

  private readonly handlers: Partial<ActionHandlers> = {
    'lobby:ready': async (event) => {
      const { rid } = event;
      const player = this.lobbyState.players.find(
        (player) => player.user.id === rid
      );

      if (!player) {
        return;
      }

      player.ready = true;
      this.broadcastPatch();
    },
  };

  async receive(req: Request) {
    return await handleResponse(req, () => {
      if (!this.initialized) {
        throw new Error('lobby not found');
      }

      return this.connect(req);
    });
  }

  private async initializeLobby() {
    console.log('initializing lobby', this.uid);
    const pack = await getPack(this.kv, this.uid);

    if (!pack) {
      return;
    }

    this.initialized = true;
    this.manifest = pack;
    this.lobbyState = {
      pack: {
        name: pack.name,
        key: pack.packKey,
      },
      round: {
        number: 1,
        name: pack.rounds[0].name,
        categories: pack.rounds[0].themes.map((category) => ({
          name: category.name,
          questions: category.questions.map((question) => ({
            price: question.price * 100,
          })),
        })),
      },
      game: {
        type: 'not-started',
      },
      host: {
        id: pack.host,
        avatar: '😎',
      },
      players: [],
    };

    this.previousLobbyState = this.lobbyState;

    this.hostState = {};

    console.log('initialized lobby', this.uid);
  }

  onopen({ rid, socket }: SingleSocketEvent): void | Promise<void> {
    if (this.manifest.host === rid) {
      socket.send(JSON.stringify(this.getHostStateMessage()));
    } else {
      const player = this.lobbyState.players.find(
        (player) => player.user.id === rid
      );

      if (!player) {
        this.lobbyState.players.push({
          score: 0,
          ready: false,
          user: {
            id: rid,
            avatar: pickRandomAvatar(),
          },
        });

        this.broadcast(JSON.stringify(this.getLobbyStateMessage()));
      }

      socket.send(JSON.stringify(this.getLobbyStateMessage()));
    }
  }

  async onmessage(state: SingleSocketEvent, data: string): Promise<void> {
    const parsed = JSON.parse(data);
    const message = actionSchema.safeParse(parsed);

    if (!message.success) {
      return;
    }

    return this.handlers[message.data.type]?.(state, message.data as never);
  }

  private getLobbyStateMessage(): Message {
    return <Message>{
      type: 'lobby',
      state: this.lobbyState,
    };
  }

  private getHostStateMessage() {
    return <Message>{
      type: 'host',
      state: this.hostState,
    };
  }

  private broadcastPatch() {
    const patch = diff(this.previousLobbyState, this.lobbyState);
    this.previousLobbyState = this.lobbyState;

    this.broadcast(
      JSON.stringify({
        type: 'patch',
        patch,
      })
    );
  }

  private boradcastHostState() {
    this.whisper(
      this.manifest.host,
      JSON.stringify(this.getHostStateMessage())
    );
  }
}

const avatars = [
  '👾',
  '👽',
  '👻',
  '🤖',
  '🤡',
  '👹',
  '👿',
  '🤠',
  '🤓',
  '💩',
  '🐒',
  '🐸',
  '🤯',
  '😍',
  '🥶',
  '🖕',
  '🦧',
];
function pickRandomAvatar() {
  const index = Math.floor(Math.random() * avatars.length);
  return avatars[index];
}
