import { createStore } from "solid-js/store";
import { z } from "zod";

export function createPersistedStore<TSchema extends z.ZodSchema>(key: string, schema: TSchema, defaultValue: z.infer<TSchema>) {
  const storedValue = getStoredValue(key, schema);

  if (!storedValue) {
    localStorage.setItem(key, JSON.stringify(defaultValue));
  }

  const [value, setValue] = createStore<z.infer<TSchema>>(storedValue ?? defaultValue);

  function setStoredValue(newValue: z.infer<TSchema>) {
    setValue(newValue);
    localStorage.setItem(key, JSON.stringify(value));
  }

  return [value, setStoredValue as typeof setValue] as const;
}

function getStoredValue<TSchema extends z.ZodSchema>(key: string, schema: TSchema): z.infer<TSchema> | null {
  let storedJson = localStorage.getItem(key);

  if (!storedJson) {
    return null;
  }

  try {
    return schema.parse(JSON.parse(storedJson));
  }
  catch {
    return null;
  }
}
