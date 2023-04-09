import { XMLParser } from 'fast-xml-parser';
import JSZip from 'jszip';

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

export async function parsePack(
  formData: FormData
): Promise<PackParsingResult> {
  const pack = formData.get('pack');

  if (!pack || !(pack instanceof Blob)) {
    return { success: false, message: 'Missing file' };
  }

  try {
    const packBuffer = await pack.arrayBuffer();

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

export function normalizeFilename(filename: string) {
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
