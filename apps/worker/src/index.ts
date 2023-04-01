import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter, createContext } from './api-router';
import { Env } from './env';
import { handleErrors } from './handlers';
import { setHeaders } from '@tic/dog';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const worker = {
  async fetch(request, env) {
    return handleErrors(request, async () => {
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          headers: {
            ...corsHeaders,
            "Access-Control-Allow-Headers": request.headers.get(
              "Access-Control-Request-Headers"
            ) ?? '*',
          },
        });
      }

      const url = new URL(request.url);
      const pathSegments = url.pathname.slice(1).split('/');

      if (pathSegments[0] === 'trpc') {
        return fetchRequestHandler({
          endpoint: '/trpc',
          req: request,
          router: appRouter,
          batching: {
            enabled: true,
          },
          createContext(args) {
            return createContext({
              ...args,
              env,
            });
          },
          responseMeta() {
            return {
              headers: {
                ...corsHeaders,
              },
            };
          }
        });
      }

      if (pathSegments[0] === 'game') {
        const username = request.headers.get('x-username') ?? url.searchParams.get('u');

        if (!username) {
          return new Response('missing username', { status: 401 });
        }

        const gameId = pathSegments[1];
        let id;
        if (gameId.match(/^[0-9a-f]{64}$/)) {
          id = env.LOBBY.idFromString(gameId);
        } else if (gameId.length <= 32) {
          id = env.LOBBY.idFromName(gameId);
        } else {
          return new Response("invaid gameId", {status: 404});
        }

        const roomObject = env.LOBBY.get(id);
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

export { TicTacToeLobby } from './lobby';

export default worker;
