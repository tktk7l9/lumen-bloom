# Lumen Bloom — 太陽と天気を映す花瓶

現在地の緯度経度から計算したリアルタイムの太陽の方位角・高度角で花瓶に光と影を落とし、現在地の天気(晴れ/曇り/雨/雪)を空間の雰囲気に反映する、常時起動できる3Dウォールペーパー。

<!-- スクリーンショット/OGP画像はシーン実装後に追加 -->

## 特徴（実装予定を含む）

- **プロシージャル生成の花瓶+花** — 外部3Dアセット不使用。`THREE.LatheGeometry`+`MeshPhysicalMaterial`(ガラス質感)と、シード付き決定論的PRNGによる花・茎のレイアウト。
- **実太陽光** — Meeus低精度式による太陽位置計算(外部天文ライブラリ不使用)。`DirectionalLight`で影を落とし、市民薄明を連続的に補間する光量カーブで朝夕夜を演出。
- **実天気** — [Open-Meteo](https://open-meteo.com/)(無料・APIキー不要)から現在地の天気を取得し、環境光のトーン・霧・雨/雪パーティクルに反映。
- **常時起動を想定した省電力設計** — タブが非表示の間はレンダーループとポーリングを一時停止。
- **`prefers-reduced-motion`対応**。

## 起動

```bash
npm install
npm run dev      # http://localhost:5173
```

## 開発

```bash
npm run typecheck   # tsc --noEmit
npm run test        # Vitest（純ロジック）
npm run coverage    # src/engine を 100% カバレッジでゲート
npm run build       # 型チェック + 本番ビルド
```

### 構成

- `src/engine/` — 純ロジック(太陽位置計算 `astro/`・方向ベクトル/幾何生成 `geometry/`・現在地 `geolocation/`・天気クライアント `weather/`・演出用シーン状態 `scene-state/`)。Vitest で 100% カバレッジを維持。Three.js に依存しない。
- `src/scene/` — Three.js のシーン組み立て(レンダラー・花瓶/花オブジェクト・太陽光・天気パーティクル)。カバレッジ対象外。
- `src/ui/` — 最小限のDOM(位置情報許可プロンプト等)。
- `src/orchestrator.ts` — Geolocation取得→太陽位置ループ→天気ポーリング→シーン更新の結線。
- `src/main.ts` — 軽量ブートストラップ。`orchestrator.ts` を `import()` で読み込む。
- `public/` — `manifest.webmanifest`・`sw.js`(オフラインシェル)・`favicon.svg`。

## 技術スタック

- Three.js
- Vite + TypeScript(Vanilla)
- Vitest（`src/engine` 100%カバレッジ）
- Vercel Analytics
- Open-Meteo API（天気、APIキー不要）

## 品質指標

<!-- 実装完了後、publish-check で Lighthouse / Observatory を計測して追記 -->
