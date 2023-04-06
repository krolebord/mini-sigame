import { Link } from '@solidjs/router';
import { createSignal, Show } from 'solid-js';

const usernameKey = 'username';

const [username, setUsername] = createSignal(getStoredUsername() ?? createAnonUsername());

window.addEventListener('storage', (e: { key: string | null }) => {
  if (e.key !== usernameKey) return;
  setUsername(getStoredUsername() ?? createAnonUsername());
});

function getStoredUsername() {
  return localStorage.getItem(usernameKey);
}

function setStoredUsername(username: string) {
  localStorage.setItem(usernameKey, username);
  setUsername(username);
}

function createAnonUsername() {
  return 'anon-' + Math.random().toString(36).substring(2, 9);
}

export function useUsername() {
  return username;
}

export function NewUserRoute() {
  const username = useUsername();

  return (
    <>
      <h1 class="text-xl font-semibold">Welcome</h1>
      <div class="flex flex-col gap-2 items-center">
        <p>Enter your name</p>
        <input
          type="text"
          value={username()}
          class="border border-slate-500 rounded-md px-2"
          onInput={(e) => {
            const input = e.target as HTMLInputElement;
            setStoredUsername(input.value);
          }}
        />
        <Show
          when={username().length > 3}
          fallback={
            <button
              class="rounded-md border border-slate-500 px-2 text-slate-500"
              disabled
            >
              Continue
            </button>
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
