export const config = {
  apiUrl: import.meta.env.DEV
    ? 'https://api.minisi.krolebord.com'
    : import.meta.env.VITE_API_URL,
  wsUrl: import.meta.env.DEV
    ? 'wss://api.minisi.krolebord.com'
    : import.meta.env.VITE_WS_URL,
  packsUrl: import.meta.env.DEV
    ? 'https://si-pack.krolebord.com'
    : import.meta.env.VITE_PACKS_URL,
};
