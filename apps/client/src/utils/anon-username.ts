export function createAnonUsername() {
  return 'anon-' + Math.random().toString(36).substring(2, 9);
}
