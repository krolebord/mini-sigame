import type { GameState, GameStatePayload, Message } from "@tic/worker";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { config } from "../config";
import { useUsername } from "./new-user";

type ExtractState<T extends GameState> = Extract<GameStatePayload, { type: T }>
type Dispatch = (action: Message) => void;

function ChooseSides({ gameState }: { gameState: ExtractState<'lobby:choose-sides'> & { dispatch: Dispatch } }) {
  const username = useUsername();

  const ready = username === gameState.lobby.player1 ? gameState.player1Ready : gameState.player2Ready;
  
  return <>
    <p>Get ready</p>
    <p>{gameState.lobby.player1} - {gameState.firstTurn === 'player1' ? 'X' : 'O'} - { gameState.player1Ready ? 'ready' : 'not ready' }</p>
    <p>{gameState.lobby.player2} - {gameState.firstTurn === 'player1' ? 'O' : 'X'} - { gameState.player2Ready ? 'ready' : 'not ready' }</p>
    <button onClick={() => gameState.dispatch({ type: 'lobby:switch-sides' })}>Switch sides</button>
    {!ready && <button onClick={() => gameState.dispatch({ type: 'lobby:ready' })}>Ready</button>}
    {ready && <button onClick={() => gameState.dispatch({ type: 'lobby:unready' })}>Not Ready</button>}
  </>;
}

function Game({ gameState }: { gameState: ExtractState<'game'> & { dispatch: Dispatch } }) {
  return <>
    <p>{gameState.lobby.player1} vs {gameState.lobby.player2}</p>
    <p>Turn: {gameState.turn}</p>
    {gameState.board.map((row, y) => <div key={y} className="flex">
      {row.map((cell, x) =>
        <button
          key={`${y}-${x}`}
          onClick={() => gameState.dispatch({ type: 'game:move', x, y })}
          className="w-8 h-8 border border-slate-500"
        >
          {cell}
        </button>
      )}
    </div>)}
  </>;
}

function GameOver({ gameState }: { gameState: ExtractState<'game:over'> & { dispatch: Dispatch } }) {
  const isDraw = gameState.winner === 'draw';
  const winner = gameState.winner === 'player1' ? gameState.lobby.player1 : gameState.lobby.player2;
  return <>
    {isDraw
      ? <p>Draw</p>
      : <p>Winner: {winner}</p>
    }
    <Link className="border border-slate-500 rounded-md px-2" to={'/home'}>Go Home</Link>
  </>;
}

export function GameRoute({ gameId }: { gameId: string }) {
  const username = useUsername();
  const [gameState, setGameState] = useState<GameStatePayload & { dispatch: Dispatch } | null>(null);

  useEffect(() => {
    const socket = new WebSocket(`${config.wsUrl}/game/${gameId}?u=${username}`);

    socket.addEventListener('message', e => {
      const message = JSON.parse(e.data);
      setGameState({
        ...message,
        dispatch: (action) => {
          socket.send(JSON.stringify(action));
        }
      });
    });

    return () => {
      socket.close();
    }
  }, [username]);
  return <>
    {!gameState && <p>Connecting...</p>}
    {gameState && <>
      <p>Game ID: {gameId}</p>
      <p>State: {gameState?.type}</p>

      {gameState.type === 'lobby:choose-sides' && <ChooseSides gameState={gameState} />}
      {gameState.type === 'game' && <Game gameState={gameState} />}
      {gameState.type === 'game:over' && <GameOver gameState={gameState} />}
    </>}
  </>;
}
