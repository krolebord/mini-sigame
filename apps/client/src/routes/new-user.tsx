import { useState, useSyncExternalStore } from "react";
import { Link } from "wouter";

const usernameKey = 'username';

export function getStoredUsername() {
  return localStorage.getItem(usernameKey);
}

export function useUsername() {
  return useSyncExternalStore(
    (onChange) => {
      const storageHandler = (e: { key: string | null }) => {
        if (e.key !== usernameKey) return;
        onChange();
      };

      const handler = () => onChange();

      window.addEventListener('storage', storageHandler);
      window.addEventListener('username-change', handler);
      return () => {
        window.removeEventListener('storage', storageHandler);
        window.removeEventListener('username-change', handler);
      };
    },
    () => getStoredUsername() ?? '',
  );
}

export function setStoredUsername(username: string) {
  localStorage.setItem(usernameKey, username);
  window.dispatchEvent(new Event('username-change'));
}

export function NewUserRoute() {
  const username = useUsername();

  return (<>
    <h1 className="text-xl font-semibold">Welcome</h1>
    <div className="flex flex-col gap-2 items-center">
      <p>Enter your name</p>
      <input
        type="text"
        value={username}
        className="border border-slate-500 rounded-md px-2"
        onInput={(e) => {
          const input = e.target as HTMLInputElement;
          setStoredUsername(input.value);
        }}
      />
      {username.length <= 3 && (
        <button className="rounded-md border border-slate-500 px-2 text-slate-500" disabled>Continue</button>
      )}
      {username.length > 3 && (
        <Link className="rounded-md border border-slate-500 px-2" to="/home">Continue</Link>
      )}
    </div>
  </>);
}
