import { useParams } from '@solidjs/router';
import { AnswerNode, QuestionNode } from '@tic/worker/src/manifest';
import {
  createEffect,
  For,
  Match,
  Show,
  Switch,
} from 'solid-js';
import { Button } from '../componets/Button';
import {
  GameProvider,
  useGameStore,
  useInvalidatePack,
  useIsHost,
} from '../componets/GameProvider';
import { ProgressLine } from '../componets/TimerLine';
import { createGameAssetUrl } from '../hooks/create-game-asset-url';
import { usePreferences } from '../hooks/use-preferences';

function PlayerAvatar(props: {
  avatar: string;
  isAnswering?: boolean;
  isAnswered?: boolean;
}) {
  return (
    <div
      class="flex select-none cursor-default items-center justify-center min-w-[6rem] min-h-[6rem] text-6xl rounded-md bg-blue-400"
      classList={{
        'border-4': props.isAnswering || props.isAnswered,
        'border-green-400': props.isAnswering,
        'border-slate-600/50': props.isAnswered,
      }}
    >
      {props.avatar}
    </div>
  );
}

function NodeDisplay(props: { node: QuestionNode | AnswerNode }) {
  return (
    <Switch fallback={<pre>{JSON.stringify(props.node, undefined, '  ')}</pre>}>
      <Match when={typeof props.node !== 'object' && props.node}>
        {(node) => <p>{node()}</p>}
      </Match>
      <Match
        when={
          typeof props.node === 'object' &&
          props.node.type === 'image' &&
          props.node
        }
      >
        {(node) => <ImageNode filename={node().filename} />}
      </Match>
      <Match
        when={
          typeof props.node === 'object' &&
          (props.node.type === 'voice' || props.node.type === 'audio') &&
          props.node
        }
      >
        {(node) => <AudioNode filename={node().filename} />}
      </Match>
      <Match
        when={
          typeof props.node === 'object' &&
          props.node.type === 'video' &&
          props.node
        }
      >
        {(node) => <VideoNode filename={node().filename} />}
      </Match>
    </Switch>
  );
}

function ImageNode(props: { filename?: string }) {
  const url = createGameAssetUrl(() => props.filename);

  return (
    <Show when={url()} fallback={<p>Image not found</p>}>
      {(url) => (
        <img class="max-h-[60vh]" src={url()} alt={'SBU COMING FOR YOU.'} />
      )}
    </Show>
  );
}

function AudioNode(props: { filename?: string }) {
  const url = createGameAssetUrl(() => props.filename);
  const [preferences, setPreferences] = usePreferences();

  let audio: HTMLAudioElement | undefined;

  createEffect(() => {
    if (!audio) return;
    audio.volume = preferences.volume;
  });

  return (
    <Show when={url()} fallback={<p>Image not found</p>}>
      {(url) => (
        <audio
          ref={audio}
          controls
          autoplay
          onvolumechange={(e) =>
            setPreferences({ volume: e.currentTarget.volume })
          }
        >
          <source src={url()} title={'SBU COMING FOR YOU.'} />
        </audio>
      )}
    </Show>
  );
}

function VideoNode(props: { filename?: string }) {
  const url = createGameAssetUrl(() => props.filename);
  const [preferences, setPreferences] = usePreferences();

  let video: HTMLVideoElement | undefined;

  createEffect(() => {
    if (!video) return;
    video.volume = preferences.volume;
  });

  return (
    <Show when={url()} fallback={<p>Image not found</p>}>
      {(url) => (
        <video
          ref={video}
          class="max-h-[60vh]"
          controls
          autoplay
          onvolumechange={(e) =>
            setPreferences({ volume: e.currentTarget.volume })
          }
        >
          <source src={url()} title={'SBU COMING FOR YOU.'} />
        </video>
      )}
    </Show>
  );
}

function RoundHeader() {
  const store = useGameStore();

  return (
    <div class="flex justify-between">
      <span>Round {store.lobbyState.round.number}</span>
      <span>{store.lobbyState.pack.name}</span>
      <span>{store.lobbyState.round.name}</span>
    </div>
  );
}
function Host() {
  const store = useGameStore();
  return (
    <div class="flex flex-col items-center host">
      <p>Host:</p>
      <PlayerAvatar avatar={store.lobbyState.host.avatar} />
      <p>{store.lobbyState.host.id}</p>
      <HostActions />
    </div>
  );
}
function Players() {
  const store = useGameStore();
  const isHost = useIsHost();

  const kickPlayer = (id: string) => {
    store.dispatch({
      type: 'host:kick',
      player: id,
    });
  };

  const setPlayerScore = (id: string, score: number) => {
    store.dispatch({
      type: 'host:set-score',
      player: id,
      score,
    });
  };
  return (
    <For each={store.lobbyState.players}>
      {(player) => (
        <div class="flex flex-col items-center">
          <PlayerAvatar
            avatar={player.user.avatar}
            isAnswering={
              store.lobbyState.game.type === 'question' &&
              store.lobbyState.game.answeringPlayer === player.user.id
            }
            isAnswered={
              store.lobbyState.game.type === 'question' &&
              store.lobbyState.game.alreadyAnswered.includes(player.user.id)
            }
          />
          <p classList={{ 'text-gray-400': !player.online }}>
            {player.user.id}
          </p>
          <Show
            when={isHost()}
            fallback={
              <p class="text-blue-900 dark:text-white">{player.score}</p>
            }
          >
            <input
              type="number"
              class="text-blue-900 text-center border rounded-sm w-24 dark:text-white"
              value={player.score}
              size={player.score.toString().length + 2}
              onblur={(e) => {
                const score = e.currentTarget.valueAsNumber;
                if (score === player.score) return;
                return setPlayerScore(player.user.id, score);
              }}
            />
            <Show when={!player.online}>
              <Button onclick={() => kickPlayer(player.user.id)}>Kick</Button>
            </Show>
          </Show>
        </div>
      )}
    </For>
  );
}

function ChooseQuestionBoard() {
  const store = useGameStore();
  const isHost = useIsHost();

  return (
    <>
      <p>Choose question: </p>
      <div class="flex flex-row gap-3 justify-center">
        <div class="flex flex-col gap-3 max-w-[9rem]">
          <For each={store.lobbyState.round.categories}>
            {(category) => (
              <p class="h-12 flex items-center break-all">{category.name}</p>
            )}
          </For>
        </div>
        <div class="flex flex-col gap-3 categories">
          <For each={store.lobbyState.round.categories}>
            {(category, categoryIndex) => (
              <div class="flex gap-2">
                <For each={category.questions}>
                  {(question, questionIndex) => (
                    <div
                      class="h-12 w-12 flex justify-center items-center rounded-sm border-blue-700 question"
                      classList={{ border: !!question }}
                    >
                      <Show when={question}>
                        {(question) => (
                          <Show
                            when={isHost()}
                            fallback={
                              <span class="">{question().price ?? 0}</span>
                            }
                          >
                            <button
                              class="h-full w-full flex justify-center items-center hover:bg-blue-100"
                              onClick={() => {
                                store.dispatch({
                                  type: 'host:choose-question',
                                  category: categoryIndex(),
                                  question: questionIndex(),
                                });
                              }}
                            >
                              <p>{question().price ?? 0}</p>
                            </button>
                          </Show>
                        )}
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            )}
          </For>
        </div>
      </div>
    </>
  );
}

function QuestionBoard() {
  const store = useGameStore();
  const isHost = useIsHost();

  const acceptAnswer = (correct: boolean) => {
    store.dispatch({
      type: 'host:accept-answer',
      correct,
    });
  };

  return (
    <Show
      when={
        (store.lobbyState.game.type === 'question' ||
          store.lobbyState.game.type === 'question:display-answer') &&
        store.lobbyState.game
      }
    >
      {(gameState) => (
        <div class="flex flex-col gap-3 justify-center items-center flex-1">
          <Show
            when={store.lobbyState.game.type === 'question' && store.lobbyState.game}
          >
            {(gameState) => (<>
              <ProgressLine progress={gameState().canAnswer ? 1 : 0} />
              <p>Category: {gameState().category}</p>
            </>)}            
          </Show>
          <For each={gameState().nodes}>
            {(node) => <NodeDisplay node={node} />}
          </For>
          <Show
            when={
              store.lobbyState.game.type === 'question' &&
              store.hostState?.answer
            }
          >
            {(answer) => (
              <p>
                Answer:{' '}
                <span class="text-transparent bg-slate-200 hover:text-inherit rounded-md dark:bg-gray-800 px-1">
                  {answer()}
                </span>
              </p>
            )}
          </Show>
          <Show
            when={
              isHost() &&
              store.lobbyState.game.type === 'question' &&
              !!store.lobbyState.game.answeringPlayer
            }
          >
            <div class="flex flex-row gap-4">
              <Button variant="default" onclick={() => acceptAnswer(true)}>
                Accept
              </Button>
              <Button variant="destructive" onclick={() => acceptAnswer(false)}>
                Reject
              </Button>
            </div>
          </Show>
        </div>
      )}
    </Show>
  );
}

function GameBoard() {
  const store = useGameStore();

  return (
    <Switch
      fallback={
        <pre>{JSON.stringify(store.lobbyState.game, undefined, '  ')}</pre>
      }
    >
      <Match when={store.lobbyState.game.type === 'choose-question'}>
        <ChooseQuestionBoard />
      </Match>
      <Match when={store.lobbyState.game.type.startsWith('question')}>
        <QuestionBoard />
      </Match>
    </Switch>
  );
}

function HostActions() {
  const store = useGameStore();
  const isHost = useIsHost();

  const startGame = () => {
    store.dispatch({
      type: 'host:start',
    });
  };

  const continueGame = () => {
    store.dispatch({
      type: 'host:continue',
    });
  };

  const skipRound = () => {
    store.dispatch({
      type: 'host:choose-round',
      round: store.lobbyState.round.number,
    });
  };

  return (
    <Show when={isHost()}>
      <div class="flex flex-col items-center gap-1">
        <Show
          when={store.lobbyState.game.type === 'not-started'}
          fallback={<Button onClick={continueGame}>Continue</Button>}
        >
          <Button onClick={startGame}>Start game</Button>
        </Show>

        <Show when={store.lobbyState.game.type === 'choose-question'}>
          <Button onclick={skipRound}>Next round</Button>
        </Show>
      </div>
    </Show>
  );
}

function Game() {
  return (
    <>
      <div class="flex flex-row w-full px-3 gap-4">
        <Host />
        <div class="flex flex-col w-full justify-center  gap-5">
          <div class="flex-[3_3_0%]min-h-[60vh] justify-center flex flex-col">
            <RoundHeader />
            <GameBoard />
          </div>
          <div class="flex justify-center gap-4 players">
            <Players />
          </div>
        </div>
      </div>
    </>
  );
}

export function GameRoute() {
  const params = useParams();
  const gameId = () => params.gameId;

  const invalidatePack = useInvalidatePack(gameId);

  return (
    <GameProvider
      gameKey={gameId()}
      loadingPack={<p>Loading pack...</p>}
      connecting={
        <div class="flex justify-center items-center gap-6">
          <p>Connecting...</p>
          <Button onClick={invalidatePack}>Reload pack</Button>
        </div>
      }
    >
      <Game />
    </GameProvider>
  );
}
