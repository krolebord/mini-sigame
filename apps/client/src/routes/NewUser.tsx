import { Link } from '@solidjs/router';
import { Show } from 'solid-js';
import { Button } from '../componets/Button';
import { usePreferences } from '../hooks/use-preferences';

export function NewUserRoute() {
  const [preferences, setPreferences] = usePreferences();

  return (
    <>
      <h1 class="text-xl font-semibold">Welcome</h1>
      <div class="flex flex-col gap-2 items-center">
        <p>Enter your name</p>
        <input
          type="text"
          value={preferences.username}
          class="border border-slate-500 rounded-md px-2"
          onInput={(e) => setPreferences({ username: e.currentTarget.value })}
        />
        <div>
          <label for="theme-selector" >Theme: </label>
          <select
            id="theme-selector"
            name="theme"
            value={preferences.theme}
            oninput={e => setPreferences({ theme: e.currentTarget.value as never })}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
        </div>
        <Show
          when={preferences.username.length > 3}
          fallback={
            <Button disabled>
              Continue
            </Button>
          }
        >
          <Link class="rounded-md border border-slate-500 px-2" href="/home">
            Continue
          </Link>
        </Show>
      </div>
    </>
  );
}
