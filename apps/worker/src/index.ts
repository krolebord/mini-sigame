import { Env } from './env';
import { handleResponse } from './handlers';
import { setHeaders } from '@tic/dog';
import { handlePackUpload } from './pack-upload';

const worker = {
  async fetch(request, env, context) {
    return handleResponse(request, async () => {
      if (request.method === 'OPTIONS') {
        return new Response(null);
      }

			const url = new URL(request.url);
      const pathSegments = url.pathname.slice(1).split('/');

			if (pathSegments[0] === 'upload-pack') {
				return handlePackUpload({
					bucket: env.SIPACKS,
					kv: env.SIGAME_KV,
					lobby: env.SIGAME_LOBBY,
					request
				});
			}

      if (pathSegments[0] === 'game') {
        const username = request.headers.get('x-username') ?? url.searchParams.get('u');

        if (!username) {
          throw new Error('missing username');
        }

        const gameId = pathSegments[1];
        let id;
        if (gameId.match(/^[0-9a-f]{64}$/)) {
          id = env.SIGAME_LOBBY.idFromString(gameId);
        } else if (gameId.length <= 32) {
          id = env.SIGAME_LOBBY.idFromName(gameId);
        } else {
          throw new Error("invaid gameId");
        }

        const roomObject = env.SIGAME_LOBBY.get(id);
        const newUrl = new URL(request.url);
        newUrl.pathname = "/";

        const req = setHeaders(request, {
          objectId: roomObject.id,
          requestId: username
        });

        return roomObject.fetch(newUrl.href, req);
      }

      return new Response('Not found', { status: 404 });
    });
  }
} satisfies ExportedHandler<Env>;

export { MiniSigameLobby } from './lobby';

export default worker;
