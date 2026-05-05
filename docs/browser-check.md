# browser-check — ブラウザ実行チェック

## browser-check とは

`npm run browser-check` は、AI Income Lab のオプション実行コマンドです。

Playwright Chromium（ヘッドレスブラウザ）で対象URLを開き、**JavaScript 描画後のページ本文**を取得して収益化シグナル・リスクシグナルを検出します。

| 項目 | 内容 |
|------|------|
| 役割 | 上位候補の実ブラウザ確認（任意実行） |
| 通常パイプラインとの関係 | `collect` / `daily` には組み込まれていない |
| 対象 | JS 描画ページ（SPA / React / Next.js 等）や GitHub README など |
| シグナル | 英語・日本語の両対応 |

---

## 使い方

### 単体 URL を確認する

```bash
npm run browser-check -- https://opencode.ai/
```

### input.txt 内の URL を最大 10 件チェックする

```bash
npm run browser-check -- --all
```

引数なしで実行すると使い方を表示します。

---

## 出力先

| ファイル | 内容 |
|---------|------|
| `data/collected/browser_check_results.json` | URL ごとの抽出結果（JSON） |
| `reports/daily/browser-check.md` | 人間が読む Markdown レポート |

どちらも `.gitignore` 対象のため Git には残りません。

---

## 注意事項

- ログインが必要なページは対象外
- X（Twitter）への自動投稿はしない
- 大量スクレイピング用途では使わない（`--all` は最大 10 件）
- リスクシグナルが検出されても `reject` にはならず `hold` 扱い
- `risk` が 2 件以上の場合も `notes` に「要文脈確認」と表示するのみ

---

## 使いどころ

- `npm run daily` で選んだ上位候補を実ブラウザで確認したいとき
- `opencode.ai` のような React/Next.js 製 SPA を正確に解析したいとき
- GitHub / SaaS サイト / AIツール LP の本文を実ページベースで確認したいとき

### フェッチ版との違い

| 方式 | 取得精度 | 速度 | SPA 対応 |
|------|---------|------|---------|
| `collect`（HTML フェッチ） | 静的 HTML のみ | 高速 | ❌ |
| `browser-check` | JS 描画後の全文 | やや遅い | ✅ |

---

## 実行前提

Playwright がインストールされている必要があります。

現在は `experiments/playwright-mcp-mvp/node_modules/playwright` を参照しています。スクリプトが自動で検索するため、以下を一度実行済みであれば追加作業は不要です。

```bash
cd experiments/playwright-mcp-mvp
npm install
```

> 将来の配布版では `dependencies` に追加する可能性があります。

---

## playwright-mcp との関係

`browser-check` は通常の Playwright スクリプトで動作します。
`claude mcp add --transport http playwright-mcp http://localhost:9323/mcp` で playwright-mcp を登録すれば、将来的に Claude Code のツールとして直接呼び出す構成への移行も可能です。

---

*AI Income Lab v2.4.2 — docs/browser-check.md*
