import { config } from '../config';
import { parsePack } from './parse-pack';

type UploadPackOptions = Pick<
  Extract<Awaited<ReturnType<typeof parsePack>>, { success: true }>,
  'manifest' | 'packedAssets'
> & {
  username: string;
};

const buildUploadUrl = (opts: {
  action: string;
  key?: string;
  uploadId?: string;
  partNumber?: string;
}) => {
  const params = new URLSearchParams(opts);
  return `${config.apiUrl}/upload-pack?${params.toString()}`;
};

export async function uploadPack(options: UploadPackOptions) {
  try {
    const { manifest: baseManifest, packedAssets, username } = options;

    const manifest = {
      ...baseManifest,
      host: username,
    };

    const response = await fetch(buildUploadUrl({ action: 'new-pack' }), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(manifest),
    });

    if (!response.ok) {
      throw new Error(`Failed to create pack: ${await response.text()}`);
    }

    const key = (await response.json()).key as string;

    await uploadFile(key, packedAssets);
    return { key };
  } catch (error) {
    console.error('upload error', error);
    throw error;
  }
}

const partSize = 8 * 1024 * 1024;

async function uploadFile(key: string, file: Blob) {
  const uploadIdResponse = await fetch(
    buildUploadUrl({ action: 'mpu-create', key }),
    {
      method: 'POST',
    }
  );
  const uploadId = (await uploadIdResponse.json()).uploadId as string;

  const partCount = Math.ceil(file.size / partSize);
  const uploadedParts = await Promise.all(
    Array.from({ length: partCount }, async (_, index) => {
      const response = await fetch(
        buildUploadUrl({
          action: 'mpu-uploadpart',
          key,
          uploadId,
          partNumber: (index + 1).toString(),
        }),
        {
          method: 'PUT',
          body: file.slice(index * partSize, (index + 1) * partSize),
          headers: { 'Content-Type': 'application/octet-stream' },
        }
      );

      return response.json();
    })
  );

  const completeResponse = await fetch(
    buildUploadUrl({ action: 'mpu-complete', key, uploadId }),
    {
      method: 'POST',
      body: JSON.stringify({ parts: uploadedParts }),
      headers: { 'Content-Type': 'application/json' },
    }
  );

  if (!completeResponse.ok) {
    throw new Error(
      `Failed to complete upload: ${await completeResponse.text()}`
    );
  }
}
