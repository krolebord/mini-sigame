import { usePreferences } from '../hooks/use-preferences';

export function ThemeSelect() {
  const [preferences, setPreferences] = usePreferences();
  return (
    <select
      id="theme-selector"
      name="theme"
      value={preferences.theme}
      oninput={(e) => setPreferences({ theme: e.currentTarget.value as never })}
    >
      <option value="light">Light</option>
      <option value="dark">Dark</option>
      <option value="system">System</option>
    </select>
  );
}
