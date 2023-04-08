import { useParams } from '@solidjs/router';
import { AnswerNode, QuestionNode } from '@tic/worker/src/manifest';
import { Accessor, createEffect, createMemo, For, Match, mergeProps, onCleanup, Show, Switch } from 'solid-js';
import toast from 'solid-toast';
import { Button } from '../componets/Button';
import { GameProvider, useGameStore, useInvalidatePack, useIsHost } from '../componets/GameProvider';
import { ProgressLine, TimerProgressLine } from '../componets/TimerLine';
import { useMediaSettings } from '../hooks/media-settings';
import { useUsername } from '../hooks/username';
import { normalizeFilename } from '../utils/parse-pack';

function PlayerAvatar(props: { avatar: string, isAnswering?: boolean, isAnswered?: boolean }) {  
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
  return <Switch
    fallback={<pre>{ JSON.stringify(props.node, undefined, '  ') }</pre>}
  >
    <Match when={typeof props.node !== 'object' && props.node}>
      {node => <p>{node()}</p>}
    </Match>
    <Match when={typeof props.node === 'object' && props.node.type === 'image' && props.node}>
      {node => <ImageNode filename={node().filename} />}
    </Match>
    <Match when={typeof props.node === 'object' && (props.node.type === 'voice' || props.node.type === 'audio') && props.node}>
      {node => <AudioNode filename={node().filename} />}
    </Match>
    <Match when={typeof props.node === 'object' && props.node.type === 'video' && props.node}>
      {node => <VideoNode filename={node().filename} />}
    </Match>
  </Switch>
}

function createGameAssetUrl(filename: Accessor<string>) {
  const store = useGameStore();

  return createMemo(() => {
    const asset = store.assets.get(normalizeFilename(filename()));

    if (!asset) {
      return null;
    }

    const url = URL.createObjectURL(asset);
    onCleanup(() => {
      URL.revokeObjectURL(url);
    });
    return url;
  });
}

function ImageNode(props: { filename: string }) {
  const url = createGameAssetUrl(() => props.filename);

  return <Show
    when={url()}
    fallback={<p>Image not found</p>}
  >
    {url => <img class="max-h-[60vh]" src={url()} />}
  </Show>;
}

function AudioNode(props: { filename: string }) {
  const url = createGameAssetUrl(() => props.filename);
  const [settings, setSettings] = useMediaSettings();

  let audio: HTMLAudioElement | undefined;

  createEffect(() => {
    if (!audio) return;
    audio.volume = settings.volume;
  });

  return <Show
    when={url()}
    fallback={<p>Image not found</p>}
  >
    {url => <audio ref={audio} controls autoplay onvolumechange={e => setSettings({ volume: e.currentTarget.volume })}>
      <source src={url()} title={props.filename} />
    </audio>}
  </Show>;
}

function VideoNode(props: { filename: string }) {
  const url = createGameAssetUrl(() => props.filename);
  const [settings, setSettings] = useMediaSettings();

  let video: HTMLVideoElement | undefined;

  createEffect(() => {
    if (!video) return;
    video.volume = settings.volume;
  });

  return <Show
    when={url()}
    fallback={<p>Image not found</p>}
  >
    {url => <video
      ref={video}
      class="max-h-[60vh]"
      controls autoplay
      onvolumechange={e => setSettings({ volume: e.currentTarget.volume })}
    >
      <source src={url()} title={props.filename} />
    </video>}
  </Show>;
}

function RoundHeader() {
  const store = useGameStore();

  return (<div class="flex justify-between">
    <span>Round {store.lobbyState.round.number}</span>
    <span>{store.lobbyState.round.name}</span>
  </div>);
}

function QuestionBoard() {
  const store = useGameStore();

  return (<Show
    when={(store.lobbyState.game.type === 'question' ||
      store.lobbyState.game.type === 'question:display-answer') && store.lobbyState.game
    }
  >
    {gameState => (
      <div class="flex flex-col gap-3 justify-center items-center flex-1">
        <Show when={store.lobbyState.game.type === 'question' && store.lobbyState.game}>
          {gameState => <Show
            when={!!gameState().timerTime}
            fallback={<TimerProgressLine start={gameState().timerStarts} end={gameState().timerStarts + 1} />}
          >
            <ProgressLine progress={1} />
          </Show>}
        </Show>
        <For each={gameState().nodes}>
          {node => (
            <NodeDisplay node={node}/>
          )}
        </For>
      </div>
    )}
  </Show>);
}

function GameBoard() {
  const store = useGameStore();
  const isHost = useIsHost();

  return (<Switch fallback={<pre>{ JSON.stringify(store.lobbyState.game, undefined, '  ') }</pre>}>
    <Match when={store.lobbyState.game.type === 'choose-question'}>
      <p>Choose question</p>
      <div class="flex flex-row gap-3">
        <div class='flex flex-col gap-3 max-w-[9rem]'>
          <For each={store.lobbyState.round.categories}>
            {(category) => (
                <p class="h-12 flex items-center">{category.name}</p>
            )}
          </For>
        </div>
        <div class="flex flex-col gap-3">
          <For each={store.lobbyState.round.categories}>
            {(category, categoryIndex) => (
              <div class="flex gap-2">
                <For each={category.questions}>
                  {(question, questionIndex) => (
                    <div
                      class="h-12 w-12 flex justify-center items-center rounded-sm border-blue-700"
                      classList={{ 'border': !!question }}
                    >
                      <Show when={question}>
                        {(question) => (
                          <Show when={isHost()} fallback={
                            <span class="">{question().price ?? 0}</span>
                          }>
                            <button
                              class='h-full w-full flex justify-center items-center hover:bg-blue-100'
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
    </Match>
    <Match when={store.lobbyState.game.type.startsWith('question')}>
      <QuestionBoard />
    </Match>
  </Switch>)
}

function HostActions() {
  const store = useGameStore();
  const isHost = useIsHost();

  const startGame = () => {
    store.dispatch({
      type: 'host:start',
    });
  }

  const continueGame = () => {
    store.dispatch({
      type: 'host:continue',
    });
  }

  const acceptAnswer = (correct: boolean) => {
    store.dispatch({
      type: 'host:accept-answer',
      correct
    });
  }

  const showAnswer = (answer: string) => {
    toast(answer, {
      id: 'answer',
      position: 'bottom-left'
    });
  }

  const skipRound = () => {
    store.dispatch({
      type: 'host:choose-round',
      round: store.lobbyState.round.number
    });
  }

  return (<Show when={isHost()}>
    <div class="flex flex-col items-center gap-1">
      <Show
        when={store.lobbyState.game.type === 'not-started'}
        fallback={<Button onClick={continueGame}>Continue</Button>}
      >
        <Button onClick={startGame}>Start game</Button>
      </Show>  
      <Show when={store.hostState?.answer}>
        {answer => (
          <Button onclick={() => showAnswer(answer())}>Show answer</Button>
        )}
      </Show>

      <Show when={store.lobbyState.game.type === 'question' && !!store.lobbyState.game.answeringPlayer}>
        <p class="font-semibold">Anser:</p>
        <Button variant="default" onclick={() => acceptAnswer(true)}>Accept</Button>
        <Button variant="destructive" onclick={() => acceptAnswer(false)}>Reject</Button>
      </Show>
      <Show when={store.lobbyState.game.type === 'choose-question'}>
        <Button onclick={skipRound}>Next round</Button>
      </Show>
    </div>
  </Show>)
}

function Game() {
  const store = useGameStore();
  const username = useUsername();
  const isHost = useIsHost();

  const kickPlayer = (id: string) => {
    store.dispatch({
      type: 'host:kick',
      player: id,
    });
  }

  const setPlayerScore = (id: string, score: number) => {
    store.dispatch({
      type: 'host:set-score',
      player: id,
      score,
    });
  }

  return (<>
    <p>{store.lobbyState.pack.name}</p>
    <div class="flex flex-col w-full px-3 gap-4">
      <div class="flex w-full gap-3">
        <div class="flex flex-col items-center">
          <p>Host:</p>
          <PlayerAvatar avatar={store.lobbyState.host.avatar} />
          <p>{store.lobbyState.host.id}</p>
          <HostActions />
        </div>
        <div class="flex-[3_3_0%] min-h-[60vh] flex flex-col">
          <RoundHeader />
          <GameBoard />
        </div>
      </div>
      <div class="flex justify-center gap-4">
        <For each={store.lobbyState.players}>
          {(player) => (
            <div class="flex flex-col items-center">
              <PlayerAvatar
                avatar={player.user.avatar}
                isAnswering={store.lobbyState.game.type === 'question' && store.lobbyState.game.answeringPlayer === player.user.id}
                isAnswered={store.lobbyState.game.type === 'question' && store.lobbyState.game.alreadyAnswered.includes(player.user.id)}
              />
              <p classList={{ 'text-gray-400': !player.online }}>
                {player.user.id}
              </p>
              <Show
                when={isHost()}
                fallback={<p class="text-blue-900">{player.score}</p>}
              >
                <input
                  type="number"
                  class="text-blue-900 text-center border border-blue-900 rounded-sm w-24"
                  value={player.score}
                  size={player.score.toString().length + 2}
                  onblur={e => {
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
      </div>
    </div>
  </>);
}

export function GameRoute() {
  const params = useParams();
  const gameId = () => params.gameId;

  const invalidatePack = useInvalidatePack(gameId);

  return (
    <GameProvider
      gameKey={gameId()}
      loadingPack={
        <p>Loading pack...</p>
      }
      connecting={<>
        <p>Connecting...</p>
        <Button onClick={invalidatePack}>Reload pack</Button>
      </>}
    >
      <Game />
    </GameProvider>
  );
}
