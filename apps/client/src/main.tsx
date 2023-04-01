import { Route, Switch } from 'wouter'
import { HomeRoute } from './routes/home'
import { getStoredUsername, NewUserRoute, setStoredUsername } from './routes/new-user'
import { createRoot } from 'react-dom/client';
import { StrictMode, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { trpc } from './trpc';
import { httpLink } from '@trpc/client';
import superjson from 'superjson';
import { GameRoute } from './routes/game';
import { config } from './config';

import './index.css';

export function App() {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      transformer: superjson,
      links: [
        httpLink({
          url: `${config.apiUrl}/trpc`,
          async headers() {
            const username = getStoredUsername();

            if (!username) {
              return {};
            }
            return {
              'x-username': username,
            };
          },
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <Switch>
          <main className="flex mt-16 flex-col items-center justify-center w-full">
            <Route path="/">
              <NewUserRoute />
            </Route>

            <Route path="/home">
              <HomeRoute />
            </Route>

            <Route path="/g/:gameId">
              {(params) => <GameRoute gameId={params.gameId!} />}
            </Route>
          </main>
        </Switch>
      </QueryClientProvider>
    </trpc.Provider>
  )
}

const username = getStoredUsername();

if (!username) {
  setStoredUsername('anon-' + Math.random().toString(36).substring(2, 9));
}

const root = createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <StrictMode>
    <App />
  </StrictMode>,
)
