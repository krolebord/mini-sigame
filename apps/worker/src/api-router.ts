import { initTRPC, TRPCError } from "@trpc/server";
import { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { z } from "zod";
import { Env } from "./env";
import superjson from 'superjson';

export type AppRouter = typeof appRouter;

export function createContext({
  req,
  resHeaders,
  env,
}: FetchCreateContextFnOptions & { env: Env }) {
  return { req, resHeaders, env };
}

const t = initTRPC.context<ReturnType<typeof createContext>>().create({
  transformer: superjson,
});

const router = t.router;
const publicProcedure = t.procedure;

const userMiddleware = t.middleware(async ({ next, ctx }) => {
  const username = ctx.req.headers.get('x-username');

  if (!username) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  return next({ ctx: { username } });
});
const userProcedure = t.procedure.use(userMiddleware)

export const appRouter = router({
  create: userProcedure
    .input(z.void())
    .mutation(({ ctx: { env } }) => {
      const id = env.LOBBY.newUniqueId();
      return { gameId: id.toString() };
    })
});

export type User = {
  username: string;
}


