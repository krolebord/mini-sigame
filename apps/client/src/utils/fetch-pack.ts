import { config } from "../config";

function getPackCaches() {
  return caches.open('si-packs');
}

export async function fetchPack(key: string, signal?: AbortSignal) {
  const url = `${config.packsUrl}/${key}`;
  const cache = await getPackCaches();

  let res = await cache.match(url);
  let pack = await res?.blob();

  if (!res) {
    res = await fetch(url, {
      signal
    });

    if (!res.ok) throw new Error('Pack not found!');

    const resClone = res.clone();
    pack = await res.blob();
    cache.put(url, resClone);
  }

  return pack;
}

export async function invalidatePackCache(key: string) {
  const url = `${config.packsUrl}/${key}`;
  const cache = await getPackCaches();
  await cache.delete(url);
}
