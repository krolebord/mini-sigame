/* @refresh reload */
import { createSignal } from "solid-js";

const usernameKey = 'username';

let storedUsername = localStorage.getItem(usernameKey);

if (!storedUsername) {
  storedUsername = createAnonUsername();
  localStorage.setItem(usernameKey, storedUsername);
}

const [username, setUsername] = createSignal(storedUsername);

function createAnonUsername() {
  return 'anon-' + Math.random().toString(36).substring(2, 9);
}

export function useUsername() {
  return username;
}

export function setStoredUsername(newUsername: string) {
  if (!newUsername) return;

  localStorage.setItem(usernameKey, newUsername);
  setUsername(newUsername);
}
