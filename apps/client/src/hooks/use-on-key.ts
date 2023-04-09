import { createEffect, onCleanup } from 'solid-js';

export function useOnKey({
  key,
  preventDefault = false,
  fn,
}: {
  key: string;
  preventDefault?: boolean;
  fn: () => void;
}) {
  const handler = (event: KeyboardEvent) => {
    if (event.key !== key) {
      return;
    }

    fn();
    
    if (preventDefault) {
      event.preventDefault();
    }
  };

  createEffect(() => {
    window.addEventListener('keyup', handler);
    onCleanup(() => {
      window.removeEventListener('keyup', handler);
    });
  });
}
