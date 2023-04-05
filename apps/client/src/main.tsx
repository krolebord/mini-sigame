import './index.css';
import { Link, Route, Switch } from 'wouter'
import { HomeRoute } from './routes/home'
import { getStoredUsername, NewUserRoute, setStoredUsername, useUsername } from './routes/new-user'
import { createRoot } from 'react-dom/client';
import { StrictMode, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GameRoute } from './routes/game';
import { Toaster } from 'react-hot-toast';


export function App() {
  const [queryClient] = useState(() => new QueryClient());
  const username = useUsername();

  return (
    <QueryClientProvider client={queryClient}>
      <Switch>
        <>
          <header className='px-2 py-1 flex justify-between border-b border-slate-400'>
            <Link to='/home'>SIU</Link>
            <Link to='/'>{username}</Link>
          </header>
          <main className="flex mt-4 flex-col items-center justify-center w-full">
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
        </>
      </Switch>
      <Toaster position="bottom-right" />
    </QueryClientProvider>
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
