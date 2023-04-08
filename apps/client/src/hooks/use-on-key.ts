import { Accessor, createEffect, onCleanup } from 'solid-js';

export function useOnKey({
  key,
  fn,
}: {
  key: Accessor<string>;
  fn: () => void;
}) {
  const handler = (event: KeyboardEvent) => {
    if (event.key === key()) {
      fn();
    }
  };

  createEffect(() => {
    window.addEventListener('keydown', handler);
    onCleanup(() => {
      window.removeEventListener('keydown', handler);
    });
  });
}
