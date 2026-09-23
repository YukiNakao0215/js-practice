# ai-news → Obsidian

AI関連のRSS/Atomフィードを毎日集約し、Obsidian vault に日次ノートとして書き出すCLIです。

## 設計方針（と、意図的にやっていないこと）

| 方針 | 理由 |
| --- | --- |
| **外部依存ゼロ** | Node 18.17+ の組み込み `fetch` だけで動きます。`npm install` 不要、サプライチェーンリスクなし、放置しても壊れにくい。代償としてRSS/Atomパーサは自前（一般的なフィードは通りますが、特殊な形式は落ちることがあります）。 |
| **LLMで要約しない** | 要約をLLMに任せると、数字や社名が微妙にズレたノートが毎日蓄積されます。現状はRSSの概要文をそのまま整形するだけなので、**書かれていないことは書かれません**。 |
| **必ず原文リンクを併記** | ノートは索引であって一次情報ではありません。判断は原文を読んでから。 |
| **エンティティを `[[wikilink]]` 化** | ここが本体です。単に日付ノートを積むだけならRSSリーダーで十分で、Obsidianを使う意味は「[[OpenAI]] のノートを開けば、そこに言及した全ニュースが逆リンクで並ぶ」ことにあります。 |
| **失敗を隠さない** | 取得に失敗したフィードはノート内に「取得エラー」節として残ります。静かに記事が減るのが一番たちの悪い壊れ方なので。 |

## 必要環境

- Node.js 18.17 以上（`node -v` で確認。Node 22 で動作確認済み）
- ローカルPC上のObsidian vault（このツールはvaultのフォルダに直接 `.md` を書きます）

## セットアップ

```bash
cd tools/ai-news

# 1. 設定ファイルを作る（任意の作業ディレクトリで実行可）
node bin/ai-news.js init

# 2. ai-news.config.json の vaultPath を自分のvaultの絶対パスに書き換える
#    例: "/Users/yuki/Documents/ObsidianVault"

# 3. フィードが生きているか確認する（ネットワークが必要）
node bin/ai-news.js check

# 4. 書き込まずに出力内容だけ見る
node bin/ai-news.js --dry-run

# 5. 本番実行
node bin/ai-news.js
```

## Windows でのセットアップ（出力先 `C:\obsidian\vault\03_AIニュース`）

この構成用の設定を `config.windows.example.json` として同梱しています。

```powershell
# 1. リポジトリを置いた場所へ移動
cd C:\path\to\js-practice\tools\ai-news

# 2. 設定をコピー（中身はそのままで C:/obsidian/vault/03_AIニュース に出力されます）
copy config.windows.example.json ai-news.config.json

# 3. フィードの疎通確認
node bin\ai-news.js check

# 4. 書き込まずに内容だけ確認
node bin\ai-news.js --dry-run

# 5. 本番実行 → C:\obsidian\vault\03_AIニュース\2026-09-15 AIニュース.md が作られる
node bin\ai-news.js
```

設定の中身:

```json
{
  "vaultPath": "C:/obsidian/vault",
  "notePath": "03_AIニュース/{{date}} AIニュース.md"
}
```

> **パスは `/` 区切りで書いてください。** JSONでは `\` がエスケープ文字なので、`"C:\obsidian\vault"` と書くとJSONの構文エラーになります
> （どうしても `\` を使うなら `"C:\\obsidian\\vault"` と2つ重ねる）。Windows版Nodeは `/` 区切りをそのまま解釈します。

### 毎日自動実行（タスクスケジューラ）

同梱の `run-ai-news.cmd` を登録するだけです。コンソールをUTF-8に切り替えてから実行し、ログを `ai-news.log` に残します。

```powershell
# 毎朝7:00に実行するタスクを作成
schtasks /create /tn "AIニュース日次まとめ" /tr "C:\path\to\js-practice\tools\ai-news\run-ai-news.cmd" /sc daily /st 07:00
```

GUIで登録する場合は「基本タスクの作成」→ 毎日 → プログラムに `run-ai-news.cmd` のフルパスを指定してください。

> PCがスリープ・シャットダウンしている時刻には実行されません。タスクのプロパティで
> 「スケジュールされた時刻にタスクを開始できなかった場合、すぐにタスクを開始する」を有効にしておくと取りこぼしが減ります。

## コマンドとオプション

```
ai-news [run]        フィードを取得してノートを書き出す（既定）
ai-news check        全フィードの疎通と件数だけ確認する（書き込みなし）
ai-news init         カレントに ai-news.config.json を作る

--config <path>      設定ファイルのパス
--dry-run            ファイルに書かず、生成されるMarkdownを標準出力に出す
--force              同じ日のノートが既にあっても上書きする
--quiet              進捗ログを出さない
-h, --help           ヘルプ
```

設定ファイルの探索順は `--config` → カレントの `ai-news.config.json` → `~/.config/ai-news/config.json` です。

終了コード: `0` 正常 / `1` 設定・引数エラー / `2` 全フィード取得失敗。

## 出力されるノート

```markdown
---
title: "AIニュース 2026-09-04"
date: 2026-09-04
type: ai-news-daily
tags:
  - ai-news
  - ai/openai
  - ai/nvidia
articles: 12
feeds_ok: 12
feeds_failed: 1
generated: "2026-09-04 07:00"
---

# AIニュース 2026-09-04

## 注目
- **企業・製品**: [[OpenAI]] (4) · [[NVIDIA]] (2)
- **テーマ**: #ai/infra (3) #ai/agent (2)

## 公式ブログ (5)

- **[OpenAI announces ...](https://openai.com/...)**
  OpenAI · 03:12
  概要文（RSSの description をHTML除去して整形したもの）
  [[OpenAI]] #ai/agent
```

`type: ai-news-daily` を入れてあるので、Dataview を使っているなら横断集計ができます。

```dataview
TABLE articles, feeds_failed FROM "AI News" WHERE type = "ai-news-daily" SORT date DESC
```

## 毎日自動実行する

### macOS（launchd 推奨）

`~/Library/LaunchAgents/com.local.ai-news.plist` を作成:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.local.ai-news</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/Users/you/js-practice/tools/ai-news/bin/ai-news.js</string>
    <string>--quiet</string>
    <string>--config</string>
    <string>/Users/you/js-practice/tools/ai-news/ai-news.config.json</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>7</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardErrorPath</key><string>/tmp/ai-news.log</string>
</dict>
</plist>
```

```bash
launchctl load ~/Library/LaunchAgents/com.local.ai-news.plist
```

`node` の絶対パスは `which node` で確認してください。launchd は `PATH` を引き継ぎません。

### Linux（cron）

```cron
0 7 * * * /usr/bin/node /home/you/js-practice/tools/ai-news/bin/ai-news.js --quiet --config /home/you/js-practice/tools/ai-news/ai-news.config.json >> /tmp/ai-news.log 2>&1
```

### Windows（タスクスケジューラ）

「基本タスクの作成」→ 毎日 → プログラム `node.exe`、引数に `bin\ai-news.js --quiet --config ...\ai-news.config.json` を指定。

> PCがスリープしている時刻には実行されません。確実に毎日残したいなら、実行時刻を「必ずPCを開いている時間帯」に置いてください。

## カスタマイズ

設定ファイルで既定値を上書きできます。主要な項目:

| キー | 既定 | 説明 |
| --- | --- | --- |
| `vaultPath` | （必須） | Obsidian vault の絶対パス |
| `notePath` | `AI News/AI-News-{{date}}.md` | vault内の出力先。`{{date}}` は `YYYY-MM-DD` |
| `timezone` | `Asia/Tokyo` | 日付・時刻の基準 |
| `windowHours` | `36` | 何時間前までの記事を対象にするか |
| `maxItemsPerFeed` | `8` | 1媒体がノートを占有するのを防ぐ上限 |
| `maxItemsTotal` | `40` | ノート全体の上限 |
| `excludeKeywords` | `[]` | この語を含む記事を除外（小文字比較） |
| `linkPrevDay` | `true` | 末尾に前日ノートへのリンクを置く |
| `stateRetentionDays` | `45` | 既出記録の保持日数 |

フィード・エンティティは2通りの指定ができます。

- `feeds` / `entities` / `topics` に配列を書く → **既定値を丸ごと置き換える**
- `extraFeeds` / `extraEntities` / `extraTopics` に書く → **既定値に追加する**
- 既定フィードを個別に止めたい場合は、`feeds` に同じ `url` で `"enabled": false` を書く

```json
{
  "extraFeeds": [
    { "name": "Zenn AI", "url": "https://zenn.dev/topics/ai/feed", "category": "日本語メディア", "lang": "ja" }
  ],
  "extraEntities": [
    { "name": "LangChain", "tag": "ai/langchain", "aliases": ["LangChain", "LangGraph"] }
  ],
  "excludeKeywords": ["sponsored", "PR:"]
}
```

## 重複排除のしくみ

`.ai-news-state.json`（設定ファイルと同じ場所）に、掲載済み記事のURLとタイトルを記録しています。RSSは数日分の記事を返し続けるため、これが無いと同じ記事が毎日並びます。

- 判定キーは「正規化URL」と「正規化タイトル」の2種類
- 正規化では `utm_*` などの追跡パラメータ、`www.`、末尾スラッシュを除去
- **同じ日に記録した分は既出扱いしません**（`--force` での再生成が空ノートで既存を潰さないため）
- 記録をリセットしたい場合は `.ai-news-state.json` を削除してください

## テスト

```bash
node --test test/*.test.js
```

ネットワークに接続せず、固定のフィードデータでパース・重複排除・描画・状態管理を検証します。

## 既知の制限

- **フィードURLは変わります。** 既定のフィード一覧はサイト側の都合で失効することがあります。まず `ai-news check` を実行し、NGのものは設定で差し替えてください（このツールを書いた環境ではネットワークが遮断されていたため、既定URLの実疎通は未検証です）。
- **要約はRSSの概要文そのまま。** 概要文を出さないフィードでは、タイトルとリンクだけの行になります。
- **英語記事は英語のまま。** 翻訳はしていません。
- **同一ニュースの言語をまたいだ重複は残ります。** 英語版と日本語版はタイトルもURLも違うため、別記事として並びます。

## 次にやるなら

1. `ai-news check` で失効フィードを潰し、自分の関心に合うフィードに入れ替える（費用対効果が一番高い）
2. 2週間運用して、実際にノートを読み返すか確認する。読まないなら件数を絞るか、`excludeKeywords` を育てる
3. それでも情報量が多すぎるなら、そこで初めてLLM要約の追加を検討する（`src/collect.js` の記事組み立て後にフックを入れる形になります）
