import JSZip from 'jszip';
import { config } from '../config';

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
      signal,
    });

    if (!res.ok) throw new Error('Pack not found!');

    const resClone = res.clone();
    pack = await res.blob();
    cache.put(url, resClone);
  }

  if (!pack) throw new Error('Pack not found!');

  return unpackAssets(pack);
}

async function unpackAssets(pack: Blob): Promise<Map<string, Blob>> {
  const zip = new JSZip();
  await zip.loadAsync(pack);
  const assets = new Map();
  const files = Array.from(Object.keys(zip.files));
  for (const relativePath of files) {
    const file = zip.file(relativePath);
    if (!file) continue;
    const blob = await file.async('blob');
    assets.set(relativePath, blob);
  }
  return assets;
}

export async function invalidatePackCache(key: string) {
  const url = `${config.packsUrl}/${key}`;
  const cache = await getPackCaches();
  await cache.delete(url);
}
