import { ReactNode, useEffect, useState } from "react";
import { Action, ActionPanel, Detail, Grid, Icon, openExtensionPreferences, showToast, Toast } from "@raycast/api";
import fetch, { Response } from "node-fetch";
import { getErrorMessage, ErrStatus400, ErrStatus401 } from "./utils/errors";
import { getPreferences } from "./utils/preferences";
import { MediaGridItem, MediaType, RawMediaItem, buildUrl, fetchItems, HelpError } from "./utils/jellyfinApi";

const preferences = getPreferences();

/**
 * A list of media types to be displayed in the grid and the dropdown.
 * The order in this list is also the order of the grid sections.
 */
const sections: MediaType[] = ["Movie", "Series"];

/**
 * Edits a toast object
 * @param toast Toast object
 * @param message New toast message
 * @param style New toast style
 */
function editToast(toast: Toast, message: string, style: Toast.Style = Toast.Style.Failure): void {
  toast.message = message;
  toast.style = style;
}

export default function Command() {
  const [isLoading, setIsLoading] = useState(true);

  const [mediaTypes, setMediaTypes] = useState<MediaType[]>(sections);
  const [media, setMedia] = useState<RawMediaItem[]>([]);

  const [error, setError] = useState<string>("");

  useEffect(() => {
    (async () => {
      const toast = await showToast({
        title: "Jellyfin",
        message: "Fetching Media Items...",
        style: Toast.Style.Animated,
      });

      try {
        const newMedia = await fetchItems(sections);
        setMedia(newMedia);
        editToast(toast, `Loaded ${newMedia.length} Media Files`, Toast.Style.Success);
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
    <Grid
      columns={Math.min(Math.max(Number(preferences.columns), 1), 7)}
      isLoading={isLoading}
      inset={Grid.Inset.Zero}
      searchBarAccessory={
        <Grid.Dropdown
          tooltip="Filter Media Type"
          storeValue
          onChange={(newValue) => {
            setMediaTypes(newValue.split(", ").map((val) => val as MediaType));
          }}
        >
          <Grid.Dropdown.Item title="All" value={sections.join(", ")} />
          {sections.map((s) => (
            <Grid.Dropdown.Item key={s} title={s} value={s} />
          ))}
        </Grid.Dropdown>
      }
    >
      {sections
        .filter((s) => mediaTypes.includes(s))
        .map((s, sIndex) => (
          <Grid.Section key={s + "_" + sIndex} title={s} aspectRatio={"3/4"}>
            {media
              .filter((m) => m.Type == s)
              .map((m, mIndex) => (
                <MediaGridItem key={s + "_" + mIndex} item={m} />
              ))}
          </Grid.Section>
        ))}

      <Grid.EmptyView title="No Media found on Jellyfin" />
    </Grid>
  );
}
