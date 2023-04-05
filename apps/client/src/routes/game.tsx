import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { GameState, HostState, LobbyState, Message } from '@tic/worker';
import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { config } from '../config';
import { useGameState } from '../hooks/use-game-state';
import { fetchPack, invalidatePackCache } from '../utils/fetch-pack';
import { useUsername } from './new-user';

function PlayerAvatar({ avatar }: { avatar: string }) {
  return (
    <div className="flex select-none cursor-default items-center justify-center min-w-[6rem] min-h-[6rem] text-6xl rounded-md bg-blue-400">
      {avatar}
    </div>
  );
}

export function GameRoute({ gameId }: { gameId: string }) {
  const data = useGameState(gameId);

  if (data.status === 'loading-pack') {
    return <p>Loading pack...</p>;
  }

  const { invalidatePack } = data;
  if (data.status === 'connecting') {
    return (
      <>
        <p>Connecting...</p>
        <button onClick={invalidatePack}>Reload pack</button>
      </>
    );
  }

  const { lobbyState, isHost } = data;

  return (
    <>
      <p>{lobbyState.pack.name}</p>
      <div className="flex flex-col w-full">
        <div className="flex w-full">
          <div className="flex px-3 flex-col items-center">
            <p>Host:</p>
            <PlayerAvatar avatar={lobbyState.host.avatar} />
            <p>{lobbyState.host.id}</p>
            {isHost && (
              <>
                <button onClick={data.startGame}>Start game</button>
              </>
            )}
          </div>
          <div className="flex-[3_3_0%] min-h-[60vh]">lobby</div>
        </div>
        <div className="flex justify-center gap-4">
          {lobbyState.players.map((player) => (
            <div key={player.user.id} className="flex flex-col items-center">
              <PlayerAvatar avatar={player.user.avatar} />
              <p className={clsx(!player.ready && 'text-gray-600')}>
                {player.user.id}
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
