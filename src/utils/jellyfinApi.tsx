import { Action, ActionPanel, Grid, Icon, Toast, showToast, useNavigation } from "@raycast/api";
import { getPreferences } from "./preferences";
import fetch from "node-fetch";
import { ErrStatus400, ErrStatus401, getErrorMessage } from "./errors";
import { ReactNode, useState } from "react";
import ListMediaCommand from "../list-movies-series";

const preferences = getPreferences();

/**
 * Represents the type of the media item
 */
export type MediaType = "Movie" | "Series" | "BoxSet";

/**
 * Item object returned by the Jellyfin REST API
 */
export interface RawMediaItem {
  Name: string;
  Id: string;
  ServerId: string;
  ProductionYear: number;
  CommunityRating: number;
  Type: MediaType;
  ImageTags: {
    Primary: string;
  };
  UserData: {
    Played: boolean;
    IsFavorite: boolean;
  };
}

export function buildUrl(paths: string[], query?: { [key: string]: string | string[] }) {
  const params = new URLSearchParams();
  if (!query) {
    query = { ApiKey: preferences.jellyfinApiKey };
  }
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      for (const val of value) {
        params.append(key, val);
      }
    } else {
      params.append(key, value);
    }
  }
  return `${preferences.jellyfinBase}/${paths.join("/")}?${params.toString()}`;
}

export function MediaGridItem({
  item,
  pushNavigation,
}: {
  item: RawMediaItem;
  pushNavigation?: (component: ReactNode) => void;
}): JSX.Element {
  const [isFavorite, setIsFavorite] = useState<boolean>(item.UserData.IsFavorite);

  const coverUrl = buildUrl(["Items", item.Id, "Images", "Primary"], {
    fillHeight: "600",
    fillWidth: "400",
    quality: "97",
    tag: item.ImageTags.Primary,
  });
  const mediaUrl = buildUrl(["web", "index.html#!", "details"], {
    id: item.Id,
    serverId: item.ServerId,
  });
  const streamUrl = buildUrl(["Items", item.Id, "Download"], {
    ApiKey: preferences.jellyfinApiKey,
  });

  let prefix = "";
  if (preferences.showWatchedStatus && item.UserData.Played) {
    prefix += "✅";
  }
  if (preferences.showFavoriteStatus && isFavorite) {
    prefix += "❤️";
  }

  const subtitle: string[] = [];
  if (item.ProductionYear) {
    subtitle.push(`${item.ProductionYear}`);
  }
  if (item.CommunityRating) {
    subtitle.push(`${Math.round(item.CommunityRating * 100) / 100}★`);
  }

  function createFavoriteHandler(favorite: boolean) {
    const favoriteUrl = buildUrl(["Users", preferences.jellyfinUserID, "FavoriteItems", item.Id]);
    return async () => {
      try {
        const resp = await fetch(favoriteUrl, { method: favorite ? "POST" : "DELETE" });
        if (!resp.ok) {
          throw new Error(`server returned status ${resp.status}`);
        }
        setIsFavorite(favorite);
        showToast({
          title: "❤️",
          message: `${favorite ? "Marked" : "Unmarked"} '${item.Name}' as Favorite`,
          style: Toast.Style.Success,
        });
      } catch (e) {
        showToast({
          title: "❤️",
          message: `Cannot Mark Item: ${getErrorMessage(e)}`,
          style: Toast.Style.Failure,
        });
      }
    };
  }

  const actions = [
    <Action.OpenInBrowser title="Open in Browser" url={mediaUrl} shortcut={{ key: "enter", modifiers: ["cmd"] }} />,
    isFavorite ? (
      <Action
        title="Unfavorite"
        icon={Icon.HeartDisabled}
        style={Action.Style.Destructive}
        onAction={createFavoriteHandler(false)}
        shortcut={{ key: "f", modifiers: ["cmd"] }}
      />
    ) : (
      <Action
        title="Favorite"
        icon={Icon.Heart}
        onAction={createFavoriteHandler(true)}
        shortcut={{ key: "f", modifiers: ["cmd"] }}
      />
    ),
  ];

  switch (item.Type) {
    case "Movie":
    case "Series":
      actions.push(
        <Action.CopyToClipboard
          title="Copy Stream/Download URL"
          content={streamUrl}
          icon={Icon.Livestream}
          shortcut={{ key: "s", modifiers: ["cmd"] }}
        />
      );
      break;
    case "BoxSet":
      actions.unshift(
        <Action
          title="View Items"
          icon={Icon.Eye}
          onAction={() => {
            pushNavigation && pushNavigation(<ListMediaCommand parentId={item.Id} />);
          }}
        />
      );
  }

  return (
    <Grid.Item
      content={coverUrl}
      title={`${prefix ? prefix + " " : ""}${item.Name}`}
      subtitle={subtitle.join(" · ")}
      actions={<ActionPanel title="Media Actions">{...actions}</ActionPanel>}
    />
  );
}

export class HelpError extends Error {
  constructor(public message: string, public helpMessage: string) {
    super(message);
  }
}

export async function fetchItems(types: MediaType[], parentId = ""): Promise<RawMediaItem[]> {
  const url = buildUrl(["Users", preferences.jellyfinUserID, "Items"], {
    SortBy: "SortName",
    SortOrder: "Ascending",
    IncludeItemTypes: types.join(","),
    Recursive: "true",
    ImageTypeLimit: "1",
    EnableImageTypes: "Primary",
    Limit: "10000",
    ParentId: parentId,
    ApiKey: preferences.jellyfinApiKey,
  });
  const resp = await fetch(url);
  if (!resp.ok) {
    const message = `Server returned ${resp.status}`;
    // maybe we can help the user a bit if the status code is a known issue
    switch (resp.status) {
      case 400:
        throw new HelpError(message, ErrStatus400);
      case 401:
        // 401 means probably API Token is wrong
        throw new HelpError(message, ErrStatus401);
    }
    throw new Error(message);
  }
  const media = (await resp.json()) as { Items: RawMediaItem[] };
  return media.Items;
}
