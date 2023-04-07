import { Link } from '@solidjs/router';
import { Show } from 'solid-js';
import { Button } from '../componets/Button';
import { setStoredUsername, useUsername } from '../hooks/username';

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
