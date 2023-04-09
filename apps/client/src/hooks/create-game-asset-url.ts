import { Accessor, createMemo, onCleanup } from "solid-js";
import { useGameStore } from "../componets/GameProvider";
import { normalizeFilename } from "../utils/parse-pack";

export function createGameAssetUrl(filename: Accessor<string | undefined>) {
  const store = useGameStore();

  return createMemo(() => {
    const name = filename();
    if (!name) {
      return null;
    }

    const asset = store.assets.get(normalizeFilename(name));

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
