import { createQuery, useQueryClient } from '@tanstack/solid-query';
import { GameState, LobbyState, HostState, Message, Action } from '@tic/worker';
import { patch } from 'jsondiffpatch';
import { Accessor, createContext, createEffect, Match, onCleanup, Switch, useContext, JSX } from 'solid-js';
import { createStore, produce, reconcile } from 'solid-js/store'
import { config } from '../config';
import { useUsername } from '../routes/NewUser';
import { fetchPack, invalidatePackCache } from '../utils/fetch-pack';

export type ExtractState<T extends GameState> = Extract<GameState, { type: T }>;
export type ExtractStateWithDispatch<T extends GameState> = ExtractState<T> & {
  dispatch: Dispatch;
};
export type Dispatch = (action: Action) => void;

type ClientGameState = {
  lobbyState: LobbyState;
  hostState?: HostState;
  dispatch: Dispatch;
};

export function useInvalidatePack(key: Accessor<string>) {
  const queryClient = useQueryClient();
  return async () => {
    await invalidatePackCache(key());
    queryClient.invalidateQueries(['pack', key()]);
  };
}
  
type GameProviderProps = {
  gameKey: string,
  loadingPack: JSX.Element,
  connecting: JSX.Element,
  children: JSX.Element
};

const GameContext = createContext<ClientGameState>();

export function GameProvider(props: GameProviderProps) {
  const packQuery = createQuery({
    queryKey: () => ['pack', props.gameKey],
    retry: 2,
    staleTime: Infinity,
    keepPreviousData: false,
    queryFn: ({ queryKey, signal }) => fetchPack(queryKey[1], signal),
  });

  const loadingPack = () => packQuery.isFetching || !packQuery.data;

  const username = useUsername();

  const [store, setStore] = createStore<ClientGameState>({} as never);

  createEffect(() => {
    if (!username() || loadingPack()) return;

    const socket = new WebSocket(`${config.wsUrl}/game/${props.gameKey}?u=${username()}`);
    
    const dispatch: Dispatch = (action) => {
      if (socket.readyState !== socket.OPEN) return;
      socket.send(JSON.stringify(action));
    };
    setStore('dispatch', dispatch);

    const handleMessage = (e: MessageEvent) => {
      const message = JSON.parse(e.data) as Message;
      switch (message.type) {
        case 'lobby':
          setStore('lobbyState', reconcile(message.state))
          break;
        case 'host':
          setStore('hostState', message.state);
          break;
        case 'patch':
          if (!store.lobbyState) return;
          setStore('lobbyState', produce(state => {
            patch(state, message.patch);
          }));
          break;
      }
    }

    const handleError = (e: Event) => {
      console.error(`[${props.gameKey}] error:`, e);
    }

    const handleOpen = () => {
      console.log(`[${props.gameKey}] open`);
    }

    const handleClose = () => {
      console.log(`[${props.gameKey}] close`);
    }

    socket.addEventListener('message', handleMessage);
    socket.addEventListener('error', handleError);
    socket.addEventListener('open', handleOpen);
    socket.addEventListener('close', handleClose);

    onCleanup(() => {
      socket.removeEventListener('message', handleMessage);
      socket.removeEventListener('error', handleError);
      socket.removeEventListener('open', handleOpen);
      socket.removeEventListener('close', handleClose);
      socket.close();
    })
  });

  return <Switch>
    <Match when={loadingPack()}>
      <>{props.loadingPack}</>
    </Match>
    <Match when={!store.lobbyState}>
      <>{props.connecting}</>
    </Match>
    <Match when={store.lobbyState}>
      <GameContext.Provider value={store}>
        <>{props.children}</>
      </GameContext.Provider>
    </Match>
  </Switch>;
}

export const useGameStore = () => {
  const store = useContext(GameContext);
  if (!store) throw new Error('useGameStore must be used within GameProvider');
  return store;
};
