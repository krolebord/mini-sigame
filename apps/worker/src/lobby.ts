import { SingleReplica, SingleSocketEvent } from '@tic/dog';
import { Delta, create as createDiffer } from 'jsondiffpatch';
import { z } from 'zod';
import { Env } from './env';
import { handleResponse } from './handlers';
import { AnswerNode, getPack, QuestionNode, StoredManifest } from './manifest';

type User = {
  id: string;
  avatar: string;
};

export type HostState = {
  hostId: string;
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
    category: string;
    nodes: QuestionNode[];
    price: number;
    canAnswer: boolean;
    answeringPlayer?: string;
    alreadyAnswered: string[];
  }
  | {
    type: 'question:display-answer';
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
    online: boolean;
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
    patch: Delta;
  }
  | {
    type: 'notification';
    options: NotificationOptions;
  }
  | {
    type: 'khil'
  };

export type NotificationOptions = {
  message: string;
  position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
} & (
    | { type: 'success' }
    | { type: 'error' }
    | { type: 'info', icon?: string }
  )

export type Action = z.infer<typeof actionSchema>;
export type ActionType = Action['type'];

type ActionHandlers = {
  [K in ActionType]: (
    event: SingleSocketEvent,
    data: Extract<Action, { type: K }>
  ) => Promise<void> | void;
};

const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ping') }),
  z.object({ type: z.literal('request-action') }),
  z.object({
    type: z.literal('host:start'),
  }),
  z.object({
    type: z.literal('host:kick'),
    player: z.string(),
  }),
  z.object({
    type: z.literal('host:set-score'),
    player: z.string(),
    score: z.number(),
  }),
  z.object({
    type: z.literal('host:choose-question'),
    category: z.number(),
    question: z.number(),
  }),
  z.object({
    type: z.literal('host:choose-round'),
    round: z.number(),
  }),
  z.object({
    type: z.literal('request-answer'),
  }),
  z.object({
    type: z.literal('host:accept-answer'),
    correct: z.boolean(),
  }),
  z.object({
    type: z.literal('host:continue'),
  })
]);

type FullState = {
  lobby: LobbyState;
  host: HostState;
}

const differ = createDiffer({
  objectHash: function (obj: any, index: number) {
    // try to find an id property, otherwise just use the index in the array
    return obj?.user?.id || obj?.name || obj?.id || obj?._id || '$$index:' + index;
  }
});

export class MiniSigameLobby extends SingleReplica {
  public maxUsers: number = 8;

  private initializedAt: number | undefined = undefined;

  private readonly questionDisplayDelay = 1000 * 2;
  private readonly showAnswerDelay = 1000 * 4;
  private readonly banDuration = 1000 * 2.5;

  private manifest!: StoredManifest;

  private lobbyState!: LobbyState;
  private previousLobbyState!: LobbyState;

  private hostState!: HostState;

  private currentQuestion?: StoredManifest['rounds'][number]['themes'][number]['questions'][number];

  private readonly lastRequestActionByUser = new Map<string, number>();

  private currentTransitionId: number | undefined = undefined;

  private readonly kv: KVNamespace;

  private readonly storageKey;
  private readonly syncPeriod = 1000 * 10;

  constructor(private state: DurableObjectState, env: Env) {
    super(state);

    this.kv = env.SIGAME_KV;

    this.storageKey = `lobby:${this.uid}`;

    this.state.blockConcurrencyWhile(() =>
      this.initializeLobby().catch(console.error)
    );
  }

  private readonly handlers: Partial<ActionHandlers> = {
    'host:kick': (event, data) => {
      if (!this.isHost(event.rid)) {
        return;
      }

      const player = this.lobbyState.players.find((player) => player.user.id === data.player);

      if (!player || player.online) {
        return;
      }

      const index = this.lobbyState.players.indexOf(player!);

      this.lobbyState.players.splice(index, 1);
      this.broadcastPatch();
    },
    'host:start': (event) => {
      if (!this.isHost(event.rid) || this.lobbyState.game.type !== 'not-started') {
        return;
      }

      this.lobbyState.game = {
        type: 'choose-question',
      };
      this.broadcastPatch();
    },
    "host:set-score": (event, data) => {
      if (!this.isHost(event.rid)) {
        return;
      }

      const player = this.lobbyState.players.find((player) => player.user.id === data.player);

      if (!player) {
        return;
      }

      player.score = data.score;
      this.broadcastPatch();
    },
    'host:continue': (event) => {
      if (!this.isHost(event.rid)) {
        return;
      }

      this.continueGame();
    },
    'host:choose-question': (event, data) => {
      if (!this.isHost(event.rid) || this.lobbyState.game.type !== 'choose-question') {
        return;
      }

      const categories = this.lobbyState.round.categories;
      if (data.category < 0 || data.category >= categories.length) {
        return;
      }

      const category = categories[data.category];
      if (data.question < 0 || data.question >= category.questions.length) {
        return;
      }

      const selectedQuestion = category.questions[data.question];
      this.currentQuestion = this.manifest
        .rounds[this.lobbyState.round.number - 1]
        ?.themes[data.category]
        ?.questions[data.question];
      if (!selectedQuestion || !selectedQuestion) {
        return;
      }

      category.questions[data.question] = null;

      this.lobbyState.game = {
        type: 'question',
        category: category.name,
        nodes: this.currentQuestion.scenario,
        canAnswer: false,
        alreadyAnswered: [],
        price: selectedQuestion.price,
      };
      this.broadcastPatch();

      this.setTransition(this.questionDisplayDelay, () => {
        if (this.lobbyState.game.type !== 'question') {
          return;
        }

        this.lobbyState.game!.canAnswer = true;
        this.broadcastPatch();
      });

      this.hostState.answer = this.currentQuestion.answer
        .filter((node): node is string => !!node && typeof node !== 'object')
        .map((node) => node.toString())
        .join(', ');

      this.boradcastHostState();
    },
    'host:choose-round': (event, data) => {
      if (!this.isHost(event.rid) || this.lobbyState.game.type !== 'choose-question' || data.round < 0 || data.round >= this.manifest.rounds.length) {
        return;
      }

      this.lobbyState.round = this.getRound(data.round);
      this.broadcastPatch();
    },
    "request-action": (event) => {
      const lastActivation = this.lastRequestActionByUser.get(event.rid);
      const isBanned = lastActivation && lastActivation + this.banDuration > Date.now();
      if (this.lobbyState.game.type !== 'question'
        || !!this.lobbyState.game.answeringPlayer
        || this.lobbyState.game.alreadyAnswered.includes(event.rid)
        || !this.lobbyState.game.canAnswer
        || isBanned)
      {
        if (!isBanned) {
          this.lastRequestActionByUser.set(event.rid, Date.now());
        }

        this.whisper(event.rid, { type: 'khil' });
        return;
      }

      const player = this.lobbyState.players.find((player) => player.user.id === event.rid);

      if (!player) {
        return;
      }

      this.lobbyState.game.answeringPlayer = player.user.id;

      this.broadcastPatch();
    },
    "host:accept-answer": (event, data) => {
      if (!this.isHost(event.rid) || this.lobbyState.game.type !== 'question' || !this.lobbyState.game.answeringPlayer) {
        return;
      }

      const game = this.lobbyState.game;

      const player = this.lobbyState.players.find((player) => player.user.id === game.answeringPlayer);

      if (!player) {
        return;
      }

      this.lobbyState.game.alreadyAnswered.push(player.user.id);
      this.lobbyState.game.answeringPlayer = undefined;

      if (data.correct) {
        player.score += this.lobbyState.game.price;

        this.broadcastNotification({
          type: 'success',
          message: `Correct! ${player.user.id} gets +${this.lobbyState.game.price}!`,
          position: 'top-center'
        });

        this.broadcastPatch();
        this.continueGame();
      }
      else {
        player.score -= this.lobbyState.game.price;

        this.broadcastNotification({
          type: 'error',
          message: `=( ${player.user.id} gets -${this.lobbyState.game.price}!`,
          position: 'top-center'
        });

        this.broadcastPatch();
      }
    }
  };

  private isHost(rid: string): boolean {
    return this.manifest.host === rid;
  }

  private continueGame() {
    this.skipTransition();

    if (this.lobbyState.game.type === 'question' && this.currentQuestion) {
      this.lobbyState.game = {
        type: 'question:display-answer',
        nodes: this.currentQuestion.answer,
      };
      this.broadcastPatch();
      this.setTransition(this.showAnswerDelay, () => this.continueGame());
      return;
    }

    if (this.lobbyState.game.type === 'question:display-answer' && this.currentQuestion) {
      this.currentQuestion = undefined;
      this.lobbyState.game = {
        type: 'choose-question',
      };
      this.broadcastPatch();
      return;
    }
  }

  private skipTransition() {
    if (this.currentTransitionId) {
      clearTimeout(this.currentTransitionId);
      this.currentTransitionId = undefined;
    }
  }

  private setTransition(delay: number, transition: () => void) {
    this.skipTransition();
    this.currentTransitionId = setTimeout(() => {
      this.currentTransitionId = undefined;
      transition();
    }, delay);
  }

  async receive(req: Request) {
    return await handleResponse(req, () => {
      if (!this.initializedAt) {
        throw new Error('lobby not found');
      }

      return this.connect(req);
    });
  }

  private async initializeLobby() {
    console.log('initializing lobby', this.uid);
    const loadedState = await this.recoverFullState();

    if (loadedState) {
      this.lobbyState.players.forEach((player) => {
        player.online = false;
      });

      this.lobbyState = loadedState.lobby;
      this.previousLobbyState = structuredClone(this.lobbyState);

      this.hostState = loadedState.host;

      this.initializedAt = Date.now();

      console.log('recovered lobby', this.uid);
      return;
    }

    const pack = await getPack(this.kv, this.uid);

    if (!pack) {
      return;
    }

    this.initializedAt = Date.now();
    this.manifest = pack;
    this.lobbyState = {
      pack: {
        name: pack.name,
        key: pack.packKey,
      },
      round: this.getRound(0),
      game: {
        type: 'not-started',
      },
      host: {
        id: pack.host,
        avatar: '😎',
      },
      players: [],
    };

    this.previousLobbyState = structuredClone(this.lobbyState);

    this.hostState = {
      hostId: pack.host,
    };

    this.storeFullState();
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
          online: true,
          user: {
            id: rid,
            avatar: pickRandomAvatar(),
          },
        });
      } else {
        player.online = true;
      }

      this.broadcastPatch();
    }

    socket.send(JSON.stringify(this.getLobbyStateMessage()));
    this.scheduleSync();
  }

  onclose({ rid }: SingleSocketEvent): void | Promise<void> {
    const player = this.lobbyState.players.find(
      (player) => player.user.id === rid
    );

    if (!player) {
      return;
    }

    player.online = false;
    this.broadcastPatch();
  }

  async onmessage(state: SingleSocketEvent, data: string): Promise<void> {
    const parsed = JSON.parse(data);
    const message = actionSchema.safeParse(parsed);

    if (!message.success) {
      return;
    }

    this.scheduleSync();
    return this.handlers[message.data.type]?.(state, message.data as never);
  }

  private getRound(index: number) {
    const round = this.manifest.rounds[index];
    return {
      number: index + 1,
      name: round.name,
      categories: round.themes.map((category) => ({
        name: category.name,
        questions: category.questions.map((question) => ({
          price: question.price,
        })),
      })),
    }
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
    const patch = differ.diff(this.previousLobbyState, this.lobbyState);
    this.previousLobbyState = structuredClone(this.lobbyState);

    if (!patch) return;

    this.broadcast(
      JSON.stringify(<Message>{
        type: 'patch',
        patch,
      })
    );
  }

  private broadcastNotification(options: NotificationOptions) {
    this.broadcast(
      JSON.stringify(<Message>{
        type: 'notification',
        options
      })
    );
  }

  private boradcastHostState() {
    this.whisper(
      this.manifest.host,
      JSON.stringify(this.getHostStateMessage())
    );
  }

  private async scheduleSync() {
    const alarm = await this.state.storage.getAlarm();

    if (alarm) {
      return;
    }

    await this.state.storage.setAlarm(Date.now() + this.syncPeriod, {
      allowUnconfirmed: true,
    });
  }

  async alarm() {
    await this.storeFullState();
  }

  private storeFullState() {
    console.log('storing full state', this.uid);
    return this.state.storage.put(this.storageKey, {
      host: this.hostState,
      lobby: this.lobbyState,
    } as FullState, {
      allowUnconfirmed: true,
    });
  }

  private async recoverFullState() {
    const state = await this.state.storage.get(this.storageKey);

    // TODO Add validation
    return state as FullState | undefined;
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
  '💩',
  '🐒',
  '🐸',
  '🤯',
  '😍',
  '🥶',
  '🦧',
];
function pickRandomAvatar() {
  const index = Math.floor(Math.random() * avatars.length);
  return avatars[index];
}
