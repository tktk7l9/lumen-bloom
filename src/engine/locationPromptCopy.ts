// Wording of the location prompt per state. The prompt first says what is
// on screen right now (the Tokyo fallback), then what the button changes
// (SHIG 32, 28); a failure says what to do next instead of silently
// re-showing the same pill (SHIG 55, 58).

export type LocationPromptState = "idle" | "pending" | "failed";

export interface LocationPromptCopy {
  message: string;
  button: string;
  /** True while a geolocation request is in flight — the button is disabled. */
  busy: boolean;
}

export function locationPromptCopy(state: LocationPromptState): LocationPromptCopy {
  switch (state) {
    case "pending":
      return { ...locationPromptCopy("idle"), button: "取得しています…", busy: true };
    case "failed":
      return {
        message:
          "位置情報を取得できませんでした。ブラウザの設定でこのサイトの位置情報を許可してから、もう一度お試しください。それまでは東京の太陽で表示します。",
        button: "もう一度試す",
        busy: false,
      };
    case "idle":
      return {
        message:
          "いまは東京の太陽で表示しています。位置情報を使うと、この場所の太陽の位置になります。",
        button: "位置情報を使う",
        busy: false,
      };
  }
}
