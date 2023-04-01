import { useLocation } from "wouter";
import { trpc } from "../trpc";
import { useUsername } from "./new-user";

export function HomeRoute() {
  const username = useUsername();

  const [_, setLocation] = useLocation();

  const { mutate: createNewGame } = trpc.create.useMutation({
    onSuccess({ gameId }) {
      setLocation(`/g/${gameId}`);
    }
  });

  function handleNewGame() {
    createNewGame();
  }

  return <>
    <h1 className="text-xl font-semibold">TicTacToe</h1>
    <div className="flex flex-col gap-2 items-center">
      <p>Hello, {username}</p>
    </div>
    <button className="rounded-md border border-slate-500 px-2" onClick={handleNewGame}>
      Create new game
    </button>
  </>;
}
