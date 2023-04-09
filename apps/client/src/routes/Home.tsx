import { useNavigate } from '@solidjs/router';
import { createMutation } from '@tanstack/solid-query';
import { toast } from 'solid-toast';
import { Button } from '../componets/Button';
import { useUsername } from '../hooks/use-preferences';
import { parsePack } from '../utils/parse-pack';
import { uploadPack } from '../utils/upload-pack';

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

  async function handleNewGameSubmit(
    e: Event & { currentTarget: HTMLFormElement }
  ) {
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
    <main class="flex flex-1 mt-4 flex-col items-center justify-center w-full">
      <h1 class="text-xl font-semibold">SiGame?</h1>
      <div class="flex flex-col gap-2 items-center">
        <p>Hello, {username()}</p>
      </div>
      <form method="post" onsubmit={handleNewGameSubmit}>
        <input
          type="file"
          name="pack"
          disabled={packUploadMutation.isLoading}
        />
        <Button type="submit" disabled={packUploadMutation.isLoading}>
          Create new game
        </Button>
      </form>
    </main>
  );
}
