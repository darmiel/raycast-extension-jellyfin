import { useEffect, useState } from "react";
import {
  Action,
  ActionPanel,
  Detail,
  Grid,
  Icon,
  openExtensionPreferences,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { getErrorMessage } from "./utils/errors";
import { getPreferences } from "./utils/preferences";
import { MediaGridItem, MediaType, RawMediaItem, fetchItems, HelpError } from "./utils/jellyfinApi";
import { editToast } from "./utils/utils";

const preferences = getPreferences();

export default function Command() {
  const [isLoading, setIsLoading] = useState(true);
  const [media, setMedia] = useState<RawMediaItem[]>([]);
  const [error, setError] = useState<string>("");

  const { push: pushNavigation } = useNavigation();

  useEffect(() => {
    (async () => {
      const toast = await showToast({
        title: "Jellyfin",
        message: "Fetching Media Items...",
        style: Toast.Style.Animated,
      });

      try {
        const newMedia = await fetchItems(["BoxSet"]);
        setMedia(newMedia);
        editToast(toast, `Loaded ${newMedia.length} Collections`, Toast.Style.Success);
      } catch (e) {
        if (e instanceof HelpError) {
          setError(e.helpMessage);
        }
        editToast(toast, getErrorMessage(e), Toast.Style.Failure);
      }
    })().then(() => setIsLoading(false));
  }, []);

  return error ? (
    <Detail
      markdown={error}
      actions={
        <ActionPanel title="Actions">
          <Action
            title="Open Preferences"
            icon={Icon.Gear}
            shortcut={{ key: "enter", modifiers: ["cmd"] }}
            onAction={() => openExtensionPreferences()}
          />
        </ActionPanel>
      }
    />
  ) : (
    <Grid columns={Math.min(Math.max(Number(preferences.columns), 1), 7)} isLoading={isLoading} inset={Grid.Inset.Zero}>
      {media.map((m, mIndex) => (
        <MediaGridItem key={mIndex} item={m} pushNavigation={pushNavigation} />
      ))}
      <Grid.EmptyView title="No Media found on Jellyfin" />
    </Grid>
  );
}
