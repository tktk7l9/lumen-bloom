# このリポジトリについて（AI/Claude向け）

現在地の太陽・月の位置と天気をリアルタイムに映す、プロシージャルひまわり花瓶の3Dウォールペーパー「Lumen Bloom」。
部屋の隅(床+壁2枚)に置いた水入りガラス花瓶+ひまわりに、窓型gobo越しの実太陽光と夜の月光で影を落とし、実天気(晴れ/曇り/霧/雨/雪/雷雨)を空の色・環境光・霧・パーティクル・稲光・積雪・霜に反映する。常時起動される壁紙用途。

## 開発規約

- **Vanilla Vite + TypeScript**。フレームワーク不使用。UIはDOM直組み(`src/ui/`)。
- **lib(engine)層 = Three.js非依存の純関数のみ**(`src/engine/**`)。scene層(`src/scene/**`)はThree.jsの組み立てのみで、engine層の出力を受け取って描画するだけに留める。花瓶・花のプロシージャル生成もこの原則で「プロファイル計算(engine)」と「ジオメトリ組み立て(scene)」を分離する。
- **オブジェクトはプロシージャル生成**。外部3Dアセット(GLTF等)は使わない方針(CSP自己完結・ライセンス不要の維持)。季節アレンジは`src/engine/arrangements.ts`のカタログ(純データ・週選択ロジック込みで100%テスト)+`src/scene/objects/arrangementFactory.ts`(カタログ→Three.jsグループ)+`objects/flora/`の種別ビルダー。新しい花を足すときはこの3点セット(カタログエントリ→floraビルダー→factoryのswitch)。`?obj=`で固定可。
- **厳格CSP前提**(`vercel.json`)。inline script/style禁止。外部リソースは天気API(`connect-src`に`https://api.open-meteo.com`のみ追加)。ガラス質感の環境マップは`three/examples/jsm/environments/RoomEnvironment.js`(完全プロシージャル)、窓格子goboや雨雪スプライトもCanvasTextureで生成し、外部画像は一切使わない。
- **Permissions-Policy は `geolocation=(self), screen-wake-lock=(self)`**。テンプレ由来の全拒否(`geolocation=()`)に戻さないこと(現在地取得が主機能のため)。cameraは`()`のまま。
- **描画の落とし穴(実測で確認済みの知見)**: ①`scene.environment`のIBLは太陽と無関係に24時間照らすので`environmentIntensity`を昼夜カーブに必ず連動させる ②transmissionガラス内のアルファ透過(水)はガラスがdepthWriteすると消える→ガラスは`depthWrite: false` ③壁はcastShadow禁止(太陽が壁の裏に回る時間帯に全画面が黒くなる) ④窓goboはcolorWrite/depthWrite無効+alphaTestでシャドウマップにのみ寄与させる。
- **重い処理の動的import**: `src/orchestrator.ts`以降は`src/main.ts`から`import()`で読み込む。ただし本アプリは起動直後から3D描画が必要な壁紙用途のため、「クリック時まで遅延」という他アプリの原則はそのままは適用しない。

## テスト方針(lib 100%)

- `src/engine/**` はカバレッジ100%ゲート(`vitest.config.ts`)。`src/scene/**`・`src/ui/**`はThree.js/DOM層として対象外。
- 太陽位置計算(`src/engine/astro/**`、skydialから移植)は fixture 突合(`__fixtures__/ephemeris.ts`、出典コメント必須): NOAA Solar Calculator・USNO・JPL Horizons。許容誤差 ±1分/±0.1°。
- 天気マッピング(`src/engine/weather/mapping.ts`)は WMO weather code の全区分+未知コードフォールバックをテーブル駆動でテスト。
- 天気クライアント(`src/engine/weather/client.ts`)は`fetchImpl`をDIし、成功/HTTPエラー/ネットワーク例外/JSON parse失敗の4系統をモックで網羅。実際のOpen-Meteoレスポンス形状は開発中に一度生アクセスで裏取りする(モックだけでは検出できないズレがあるため)。
- プロシージャル生成(`src/engine/geometry/**`)は決定性(同シード→同出力)・不変量(半径>0等)・境界値でテスト。

## 天体計算の出典

- 太陽: Meeus "Astronomical Algorithms" ch.25 低精度式(誤差~0.01°)。月: Meeus ch.47 truncated(~0.05°)+ch.48(月齢・輝面比)、skydialから移植。座標変換・大気差(Sæmundsson)は`src/engine/astro/coords.ts`。方位規約はN=0°時計回り。
- 太陽方向ベクトル`sunDirection(azDeg, altDeg)`は`[sin(az)cos(alt), sin(alt), -cos(az)cos(alt)]`のENU単位ベクトルで、Three.jsのY-up/-Z=北座標系にそのまま合致する(座標変換不要)。
- 演出用の光量カーブ(`src/engine/scene-state/sunLighting.ts`、市民薄明を連続補間)は天文学的事実ではなく演出上の写像なのでfixture突合の対象外。境界値・単調性のテストで担保する。

## 天気の出典

- [Open-Meteo](https://open-meteo.com/) `current` API(無料・APIキー不要・CORS対応)。WMO weather codeで晴れ/曇り/霧/雨/雪/雷雨を判定。
- フェッチ失敗時は直近の正常値を保持(`shouldKeepStale`)。一度も成功していない場合のみニュートラルな演出にフォールバックし、天気APIが完全に落ちても壁紙として破綻しない設計。

## コミット粒度

フェーズ単位(天文エンジン移植/Three.jsスケルトン/花瓶・花/太陽光結線/Geolocation結線/天気クライアント/天気演出/仕上げ)でまとまったら commit。テストとセットで。
tsc green / test green / build green を保ってから commit する。

## 留意

- **public**(2026-07-14〜)。公開リポジトリなので個人情報・実データをコード/テストに入れない。
- 太陽・月の位置・天気とも概算(航海・測量・防災用途ではない)。窓格子は太陽方向に追従する様式化された演出(実在の窓の方位シミュレーションではない)。
