import { useMutation } from "@tanstack/react-query";
import { FormEvent } from "react";
import { toast } from "react-hot-toast";
import { useLocation } from "wouter";
import { parsePack } from "../utils/parse-pack";
import { uploadPack } from "../utils/upload-pack";
import { useUsername } from "./new-user";

export function HomeRoute() {
  const username = useUsername();
  const [_, setLocation] = useLocation();

  const { mutate: createGame, isLoading } = useMutation({
    async mutationFn(opts: Parameters<typeof uploadPack>[0]) {
      const uploadResult = await toast.promise(uploadPack(opts), {
        loading: "Uploading game data",
        success: "Game data uploaded",
        error: "Failed to upload game data",
      });
      
      setLocation(`/g/${uploadResult.key}`);
    }
  });

  async function handleNewGameSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const parseResult = await parsePack(formData);

    if (!parseResult.success) {
      toast.error(parseResult.message ? `Invalid game data: ${parseResult.message}` :  "Invalid game data");
      return;
    }

    createGame({
      username,
      manifest: parseResult.manifest,
      packedAssets: parseResult.packedAssets,
    })
  }

  return <>
    <h1 className="text-xl font-semibold">SiGame?</h1>
    <div className="flex flex-col gap-2 items-center">
      <p>Hello, {username}</p>
    </div>
    <form method="POST" onSubmit={handleNewGameSubmit}>
      <input type="file" name="pack" />
      <button type="submit" disabled={isLoading} className="rounded-md border border-slate-500 px-2 disabled:bg-slate-200">
        Create new game
      </button>
    </form>
  </>;
}
