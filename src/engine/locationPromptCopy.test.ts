import { locationPromptCopy } from "./locationPromptCopy";

describe("locationPromptCopy", () => {
  it("states what is shown now before offering the upgrade", () => {
    const c = locationPromptCopy("idle");
    expect(c.message).toBe(
      "いまは東京の太陽で表示しています。位置情報を使うと、この場所の太陽の位置になります。",
    );
    expect(c.button).toBe("位置情報を使う");
    expect(c.busy).toBe(false);
  });

  it("shows progress while the fix is pending", () => {
    const c = locationPromptCopy("pending");
    expect(c.button).toBe("取得しています…");
    expect(c.busy).toBe(true);
  });

  it("explains a failure constructively and offers a retry", () => {
    const c = locationPromptCopy("failed");
    expect(c.message).toBe(
      "位置情報を取得できませんでした。ブラウザの設定でこのサイトの位置情報を許可してから、もう一度お試しください。それまでは東京の太陽で表示します。",
    );
    expect(c.button).toBe("もう一度試す");
    expect(c.busy).toBe(false);
  });
});
