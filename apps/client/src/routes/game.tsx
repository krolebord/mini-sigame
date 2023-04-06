import { useParams } from '@solidjs/router';
import { For, Show } from 'solid-js';
import { GameProvider, useGameStore, useInvalidatePack, useIsHost } from '../componets/Game';

function PlayerAvatar({ avatar }: { avatar: string }) {
  return (
    <div class="flex select-none cursor-default items-center justify-center min-w-[6rem] min-h-[6rem] text-6xl rounded-md bg-blue-400">
      {avatar}
    </div>
  );
}

function Game() {
  const store = useGameStore();
  const isHost = useIsHost();

  const kickPlayer = (id: string) => {
    store.dispatch({
      type: 'host:kick',
      player: id,
    });
  }

  return (<>
    <p>{store.lobbyState.pack.name}</p>
    <div class="flex flex-col w-full">
      <div class="flex w-full">
        <div class="flex px-3 flex-col items-center">
          <p>Host:</p>
          <PlayerAvatar avatar={store.lobbyState.host.avatar} />
          <p>{store.lobbyState.host.id}</p>
          <Show when={store.hostState}>
            <button onClick={() => {}}>Start game</button>
          </Show>
        </div>
        <div class="flex-[3_3_0%] min-h-[60vh]">lobby</div>
      </div>
      <div class="flex justify-center gap-4">
        <For each={store.lobbyState.players}>
          {(player) => (
            <div class="flex flex-col items-center">
              <PlayerAvatar avatar={player.user.avatar} />
              <p classList={{ 'text-gray-400': !player.online }}>
                {player.user.id}
              </p>
              <Show when={!player.online && isHost()}>
                 <button onclick={() => kickPlayer(player.user.id)}>Kick</button>
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
        <button onClick={invalidatePack}>Reload pack</button>
      </>}
    >
      <Game />
    </GameProvider>
  );
}
