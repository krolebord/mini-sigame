import { createStore, StoreSetter } from "solid-js/store";
import { z } from 'zod';

const mediaSettingsKey = 'media';

const mediaSettingsSchema = z.object({
  volume: z.number().min(0).max(1),
});

let storedMediaSettings!: z.infer<typeof mediaSettingsSchema>;

const storedJson = localStorage.getItem(mediaSettingsKey);
if (storedJson) {
  try {
    storedMediaSettings = mediaSettingsSchema.parse(JSON.parse(storedJson));
  }
  catch (e) {
    console.warn('Invalid media settings', e);
    localStorage.removeItem(mediaSettingsKey);
  }
}

if (!storedMediaSettings) {
  storedMediaSettings = {
    volume: 0.5
  }
}

const [mediaSettings, setMediaSettings] = createStore(storedMediaSettings);

function setStoredMediaSettings(settingsPatch: Partial<z.infer<typeof mediaSettingsSchema>>) {
  setMediaSettings(settingsPatch);
  localStorage.setItem(mediaSettingsKey, JSON.stringify(mediaSettings));
}

export function useMediaSettings() {
  return [mediaSettings, setStoredMediaSettings] as const;
}
