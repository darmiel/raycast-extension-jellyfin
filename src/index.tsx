import { ReactNode, useEffect, useState } from "react";
import { Action, ActionPanel, Detail, getPreferenceValues, Grid, Icon, openExtensionPreferences, showToast, Toast } from "@raycast/api";
import fetch, { Response } from "node-fetch";
import { ErrStatus400, ErrStatus401 } from "./errors/jellyfinErrors"

const preferences = getPreferenceValues<Preferences>();

/**
 * Represents the type of the media item
 */
type MediaType = "Movie" | "Series";

/**
 * Item object returned by the Jellyfin REST API
 */
interface RawMediaItem {
  Name: string;
  Id: string;
  ProductionYear: number;
  CommunityRating: number;
  Type: MediaType;
  ImageTags: {
    Primary: string;
  };
  UserData: {
    Played: boolean;
  };
}

/**
 * A list of media types to be displayed in the grid and the dropdown.
 * The order in this list is also the order of the grid sections.
 */
const sections: MediaType[] = ["Movie", "Series"];

interface Preferences {
  jellyfinBase: string;
  jellyfinUserID: string;
  jellyfinApiKey: string;
}

/**
 * Extracts the error message from an unknown error-like object
 * @param error The error to get the message from
 * @returns the error message as a string
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

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

function transformMediaGridItem(item: RawMediaItem, key: string): ReactNode {
  const coverUrl = `${preferences.jellyfinBase}/Items/${item.Id}/Images/Primary?fillHeight=600&fillWidth=400&quality=96&tag=${item.ImageTags.Primary}`;
  const rating = Math.round(item.CommunityRating * 100) / 100;
  return <Grid.Item key={key} content={coverUrl} title={item.Name} subtitle={`${item.ProductionYear} · ${rating}`} />;
}

export default function Command() {
  const [isLoading, setIsLoading] = useState(true);

  const [mediaTypes, setMediaTypes] = useState<MediaType[]>(sections);
  const [media, setMedia] = useState<RawMediaItem[]>([]);

  const [error, setError] = useState<string>("");

  async function updateMedia() {
    const toast = await showToast({
      title: "Jellyfin",
      message: "Fetching Media Items...",
      style: Toast.Style.Animated,
    });

    let resp: Response;
    try {
      const url = `${preferences.jellyfinBase}/Users/${
        preferences.jellyfinUserID
      }/Items?SortBy=SortName&SortOrder=Ascending&IncludeItemTypes=${sections.join(
        ","
      )}&Recursive=true&ImageTypeLimit=1&EnableImageTypes=Primary&Limit=10000&ApiKey=${preferences.jellyfinApiKey}`;
      resp = await fetch(url);
    } catch (e) {
      return editToast(toast, getErrorMessage(e));
    }
    if (!resp.ok) {
      editToast(toast, `Server returned ${resp.status}`);

      // maybe we can help the user a bit if the status code is a known issue
      switch (resp.status) {
        case 400:
          // 400 means probably User ID is wrong
          return setError(ErrStatus400);
        case 401:
          // 401 means probably API Token is wrong
          return setError(ErrStatus401);
      }

      return 
    }

    toast.message = "Preparing Media Items...";

    const newMedia = (await resp.json()) as { Items: RawMediaItem[] };
    setMedia(newMedia.Items);

    return editToast(toast, `Loaded ${newMedia.Items.length} Media Files`, Toast.Style.Success);
  }

  useEffect(() => {
    (async () => {
      await updateMedia();
      setIsLoading(false);
    })();
  }, []);

  return error ? (
    <Detail markdown={error} actions={<ActionPanel title="Actions" children={
    <Action title="Open Preferences" icon={Icon.Gear} shortcut={{key: 'enter', modifiers: ['cmd']}} onAction={() => openExtensionPreferences()} />
    } />} />
  ) : (
    <Grid
      columns={7}
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
          <Grid.Section
            key={s + "_" + sIndex}
            title={s}
            aspectRatio={"3/4"}
            children={media.filter((m) => m.Type == s).map((m, mIndex) => transformMediaGridItem(m, s + "_" + mIndex))}
          />
        ))}

      <Grid.EmptyView title="No Media found on Jellyfin" />
    </Grid>
  );
}
