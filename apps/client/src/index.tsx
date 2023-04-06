/* @refresh reload */
import './index.css';
import { render } from 'solid-js/web';
import { Link, Route, Router, Routes } from '@solidjs/router';
import { HomeRoute } from './routes/Home';
import {
  NewUserRoute,
  useUsername,
} from './routes/NewUser';
import { QueryClient, QueryClientProvider } from '@tanstack/solid-query';
import { GameRoute } from './routes/Game';
import { Toaster } from 'solid-toast';

export function App() {
  const queryClient = new QueryClient();
  const username = useUsername();

  return (
    <Router>
      <QueryClientProvider client={queryClient}>
        <header class="px-2 py-1 flex justify-between border-b border-slate-400">
          <Link href="/home">SIU</Link>
          <Link href="/">{username()}</Link>
        </header>
        
        <main class="flex mt-4 flex-col items-center justify-center w-full">
          <Routes>
            <Route path="/" component={NewUserRoute} />
            <Route path="/home" component={HomeRoute} />
            <Route path="/g/:gameId" component={GameRoute} />
          </Routes>
          
        </main>

        <Toaster position="bottom-right" />
      </QueryClientProvider>
    </Router>
  );
}

const root = document.getElementById('root');

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    'Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got mispelled?',
  );
}

render(() => <App />, root!);
