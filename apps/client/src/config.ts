export const config = {
  apiUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:8788',
  wsUrl: import.meta.env.VITE_WS_URL ?? 'ws://localhost:8788',
}
