export const config = {
  apiUrl: import.meta.env.DEV
    ? 'http://localhost:8788'
    : import.meta.env.VITE_API_URL,
  wsUrl: import.meta.env.DEV
    ? 'ws://localhost:8788'
    : import.meta.env.VITE_WS_URL,
  packsUrl: import.meta.env.DEV
    ? 'https://dev.si-pack.krolebord.com'
    : import.meta.env.VITE_PACKS_URL,
};
