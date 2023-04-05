import { useQuery, useQueryClient } from '@tanstack/react-query';
import { GameState, LobbyState, HostState, Message, Action } from '@tic/worker';
import { diffApply } from 'just-diff-apply';
import { useRef, useState, useEffect } from 'react';
import { config } from '../config';
import { useUsername } from '../routes/new-user';
import { fetchPack, invalidatePackCache } from '../utils/fetch-pack';

export type ExtractState<T extends GameState> = Extract<GameState, { type: T }>;
export type ExtractStateWithDispatch<T extends GameState> = ExtractState<T> & {
  dispatch: Dispatch;
};
export type Dispatch = (action: Action) => void;

export function useGameState(key: string) {
  const username = useUsername();
  const dispatchRef = useRef<Dispatch>();

  const [lobbyState, setLobbyState] = useState<LobbyState | null>(null);
  const [hostState, setHostState] = useState<HostState | null>(null);

  const { isFetching: isLoadingPack, data: pack } = useQuery({
    queryKey: ['pack', key],
    retry: 2,
    staleTime: Infinity,
    keepPreviousData: false,
    queryFn: ({ queryKey, signal }) => fetchPack(queryKey[1], signal),
  });

  const queryClient = useQueryClient();
  const invalidatePack = async () => {
    await invalidatePackCache(key);
    queryClient.invalidateQueries(['pack', key]);
  };

  useEffect(() => {
    if (!username || isLoadingPack) return;

    const socket = new WebSocket(`${config.wsUrl}/game/${key}?u=${username}`);
    dispatchRef.current = (action) => {
      if (socket.readyState !== socket.OPEN) return;
      socket.send(JSON.stringify(action));
    };

    socket.addEventListener('message', (e) => {
      const message = JSON.parse(e.data) as Message;
      switch (message.type) {
        case 'lobby':
          setLobbyState(message.state);
          break;
        case 'host':
          setHostState(message.state);
          break;
        case 'patch':
          setLobbyState((state) => {
            if (!state) return state;
            return diffApply(state, message.patch) as never;
          });
          break;
      }
    });

    return () => {
      socket.close();
    };
  }, [isLoadingPack, username, key]);

  if (isLoadingPack) return { status: 'loading-pack' } as const;

  if (!lobbyState) return { status: 'connecting', invalidatePack } as const;

  const dispatch: Dispatch = (action) => {
    if (!dispatchRef.current) return;
    dispatchRef.current(action);
  };

  const data = {
    status: 'connected',
    isHost: false,
    username,
    lobbyState,
    dispatch,
    invalidatePack,
  } as const;

  const isHost = lobbyState.host.id === username;
  if (isHost) {
    const startGame = () => {
      dispatch({ type: 'host:start' });
    };

    return {
      ...data,
      isHost: true,
      hostState,
      startGame,
    } as const;
  }

  return data;
}
