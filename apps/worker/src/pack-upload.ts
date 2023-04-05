import { manifestSchema, putPack } from './manifest';

type PackUploadOptions = {
  bucket: R2Bucket;
  kv: KVNamespace;
  lobby: DurableObjectNamespace;
  request: Request;
};

export async function handlePackUpload({
  request,
  bucket,
  kv,
  lobby,
}: PackUploadOptions) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  const key = url.searchParams.get('key');
  const uploadId = url.searchParams.get('uploadId');

  if (!key && action === 'new-pack' && request.method === 'POST') {
    const rawManifest = await request.json();
    const manifestResult = manifestSchema.safeParse(rawManifest);

    if (!manifestResult.success) {
      return new Response(manifestResult.error.message, { status: 400 });
    }

    const id = lobby.newUniqueId();
    const key = id.toString();

    await putPack(kv, {
      ...manifestResult.data,
      packKey: id.toString(),
    });

    return new Response(JSON.stringify({ key }));
  }

  if (!action || !key) {
    return new Response('Missing action', { status: 400 });
  }

  switch (request.method) {
    case 'POST':
      switch (action) {
        case 'mpu-create': {
          const multipartUpload = await bucket.createMultipartUpload(key);
          return new Response(
            JSON.stringify({
              key: multipartUpload.key,
              uploadId: multipartUpload.uploadId,
            })
          );
        }
        case 'mpu-complete': {
          if (uploadId === null) {
            return new Response('Missing uploadId', { status: 400 });
          }

          const multipartUpload = bucket.resumeMultipartUpload(key, uploadId);

          interface completeBody {
            parts: R2UploadedPart[];
          }
          const completeBody: completeBody = await request.json();
          if (completeBody === null) {
            return new Response('Missing or incomplete body', {
              status: 400,
            });
          }

          // Error handling in case the multipart upload does not exist anymore
          try {
            const object = await multipartUpload.complete(completeBody.parts);
            return new Response(null, {
              headers: {
                etag: object.httpEtag,
              },
            });
          } catch (error: any) {
            console.error('upload error', error);
            return new Response(error.message, { status: 400 });
          }
        }
        default:
          return new Response(`Unknown action ${action} for POST`, {
            status: 400,
          });
      }
    case 'PUT':
      switch (action) {
        case 'mpu-uploadpart': {
          const uploadId = url.searchParams.get('uploadId');
          const partNumberString = url.searchParams.get('partNumber');
          if (partNumberString === null || uploadId === null) {
            return new Response('Missing partNumber or uploadId', {
              status: 400,
            });
          }
          if (request.body === null) {
            return new Response('Missing request body', { status: 400 });
          }

          const partNumber = parseInt(partNumberString);
          const multipartUpload = bucket.resumeMultipartUpload(key, uploadId);
          try {
            const buff = await request.arrayBuffer();
            const uploadedPart: R2UploadedPart =
              await multipartUpload.uploadPart(partNumber, buff);
            return new Response(JSON.stringify(uploadedPart));
          } catch (error: any) {
            return new Response(error.message, { status: 400 });
          }
        }
        default:
          return new Response(`Unknown action ${action} for PUT`, {
            status: 400,
          });
      }
    case 'GET':
      if (action !== 'get') {
        return new Response(`Unknown action ${action} for GET`, {
          status: 400,
        });
      }
      const object = await bucket.get(key);
      if (object === null) {
        return new Response('Object Not Found', { status: 404 });
      }
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('etag', object.httpEtag);
      return new Response(object.body, { headers });
    case 'DELETE':
      switch (action) {
        case 'mpu-abort': {
          const uploadId = url.searchParams.get('uploadId');
          if (uploadId === null) {
            return new Response('Missing uploadId', { status: 400 });
          }
          const multipartUpload = bucket.resumeMultipartUpload(key, uploadId);

          try {
            multipartUpload.abort();
          } catch (error: any) {
            return new Response(error.message, { status: 400 });
          }
          return new Response(null, { status: 204 });
        }
      }
  }

  return new Response('HuH?', { status: 404 });
}
