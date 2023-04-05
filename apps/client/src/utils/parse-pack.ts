import { XMLParser } from 'fast-xml-parser';
import JSZip from 'jszip';
import { z } from 'zod';
import { zfd } from 'zod-form-data';

type PackParsingResult =
  | {
      success: true;
      manifest: object;
      packedAssets: Blob;
    }
  | {
      success: false;
      message?: string;
    };

const packSchema = zfd.formData({
  pack: zfd.file(),
});

export async function parsePack(
  formData: FormData
): Promise<PackParsingResult> {
  const parseResult = packSchema.safeParse(formData);

  if (!parseResult.success) {
    return { success: false, message: parseResult.error.message };
  }

  try {
    const packBuffer = await parseResult.data.pack.arrayBuffer();

    const zip = new JSZip();
    await zip.loadAsync(packBuffer);

    const manifestPromise = zip.file('content.xml')?.async('string');

    if (!manifestPromise) {
      return { success: false, message: 'missing manifest file' };
    }

    const xmlParser = new XMLParser({
      attributeNamePrefix: 'meta_',
      allowBooleanAttributes: true,
      ignoreAttributes: false,
      parseTagValue: true,
    });
    const manifest = xmlParser.parse(await manifestPromise);

    const assets = new Map<string, Blob>();

    const assetFolders = ['Images', 'Audio', 'Video'];
    const validFiles = Object.entries(zip.files).filter(([filename, file]) => {
      const folder = filename.split('/')[0];
      return assetFolders.includes(folder) && !file.dir;
    });
    for (const [_, entry] of validFiles) {
      const name = entry.unsafeOriginalName?.split('/').pop();

      if (!name) {
        continue;
      }

      assets.set(
        normalizeFilename(decodeURIComponent(name)),
        await entry.async('blob')
      );
    }

    const packedAssets = await packAssets(assets);

    // const key = normalizeFilename((manifest.rounds[2].themes[4].questions[2].scenario[1] as any).filename);
    // const blob = assets.get(key);
    // (document.getElementById('test') as any).src = URL.createObjectURL(blob!);

    return {
      success: true,
      packedAssets,
      manifest,
    };
  } catch (e) {
    console.error('parse error', e);
    return { success: false, message: 'unexpected error' };
  }
}

function normalizeFilename(filename: string) {
  return encodeURIComponent(filename);
}

async function packAssets(assets: Map<string, Blob>) {
  const zip = new JSZip();

  for (const [filename, content] of assets) {
    zip.file(filename, content);
  }

  const assetsPack = await zip.generateAsync({ type: 'blob' });

  return assetsPack;
}
