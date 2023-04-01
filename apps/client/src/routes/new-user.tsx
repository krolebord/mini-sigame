import { useState } from "react";
import { Link } from "wouter";

export function getStoredUsername() {
  return localStorage.getItem('username');
}

export function useUsername() {
  return getStoredUsername() ?? '';
}

export function setStoredUsername(username: string) {
  localStorage.setItem('username', username);
}

export function NewUserRoute() {
  const [username, setUsername] = useState(getStoredUsername() || '');

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
          return setUsername(input.value);
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
