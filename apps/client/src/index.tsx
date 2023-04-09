import './index.css';
import { render } from 'solid-js/web';
import { Link, Route, Router, Routes } from '@solidjs/router';
import { HomeRoute } from './routes/Home';
import { NewUserRoute } from './routes/NewUser';
import { QueryClient, QueryClientProvider } from '@tanstack/solid-query';
import { GameRoute } from './routes/Game';
import { Toaster } from 'solid-toast';
import { useUsername } from './hooks/use-preferences';
import { syncTheme } from './hooks/sync-theme';
import { ThemeSelect } from './componets/ThemeSelect';

export function App() {
  const queryClient = new QueryClient();
  const username = useUsername();

  return (
    <Router>
      <QueryClientProvider client={queryClient}>
        <header class="px-2 py-1 flex justify-between border-b items-center border-slate-400 min-h-[var(--header-height)] max-h-[var(--header-height)]">
          <Link href="/home">SIU</Link>
          <ThemeSelect />
          <Link href="/">{username()}</Link>
        </header>

        <Routes>
          <main class="flex flex-1 mt-4 flex-col items-center justify-center w-full">
            <Route path="/" component={NewUserRoute} />
            <Route path="/home" component={HomeRoute} />
          </main>
          <Route path="/g/:gameId" component={GameRoute} />
        </Routes>

        <Toaster position="bottom-right" />
      </QueryClientProvider>
    </Router>
  );
}

const root = document.getElementById('root');

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    'Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got mispelled?'
  );
}

syncTheme();

render(() => <App />, root!);
