import { getPreferenceValues } from "@raycast/api";

export interface Preferences {
  jellyfinBase: string;
  jellyfinUserID: string;
  jellyfinApiKey: string;
  columns: number;
}

export function getPreferences(): Preferences {
    return getPreferenceValues<Preferences>();
}