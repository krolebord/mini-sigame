import { useNavigate } from '@solidjs/router';
import { createMutation } from '@tanstack/solid-query';
import { toast } from 'solid-toast';
import { parsePack } from '../utils/parse-pack';
import { uploadPack } from '../utils/upload-pack';
import { useUsername } from './NewUser';

export function HomeRoute() {
  const username = useUsername();
  const navigate = useNavigate();

  const packUploadMutation = createMutation({
    async mutationFn(opts: Parameters<typeof uploadPack>[0]) {
      const uploadResult = await toast.promise(uploadPack(opts), {
        loading: 'Uploading game data',
        success: 'Game data uploaded',
        error: 'Failed to upload game data',
      });

      navigate(`/g/${uploadResult.key}`);
    },
  });

  async function handleNewGameSubmit(e: Event & { currentTarget: HTMLFormElement }) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const parseResult = await parsePack(formData);

    if (!parseResult.success) {
      toast.error(
        parseResult.message
          ? `Invalid game data: ${parseResult.message}`
          : 'Invalid game data'
      );
      return;
    }

    packUploadMutation.mutate({
      username: username(),
      manifest: parseResult.manifest,
      packedAssets: parseResult.packedAssets,
    });
  }

  return (
    <>
      <h1 class="text-xl font-semibold">SiGame?</h1>
      <div class="flex flex-col gap-2 items-center">
        <p>Hello, {username()}</p>
      </div>
      <form method="post" onsubmit={handleNewGameSubmit}>
        <input type="file" name="pack" />
        <button
          type="submit"
          disabled={packUploadMutation.isLoading}
          class="rounded-md border border-slate-500 px-2 disabled:bg-slate-200"
        >
          Create new game
        </button>
      </form>
    </>
  );
}
