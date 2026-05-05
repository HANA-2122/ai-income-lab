# AI Income Lab — Starter Kit

> AI活用事例・自動化ツール・収益化パターンを収集・評価・転用するローカルリサーチOS

**「AI で稼ぐ方法」を教えるツールではありません。**
「AI 活用事例の本質を抽出し、自分の強み市場に転用するための研究環境」です。

---

## これは何をするツールか

毎日 X・GitHub・Hacker News に大量のAI自動化・収益化ネタが流れています。
しかし「表面的な真似」では再現性が低く、「誇大主張の見分け方」も難しい。

AI Income Lab は次の3ステップを自動化します：

```
収集（GitHub / HN / 手動URL）
    ↓
評価（採用 / 保留 / 不採用 + 本質抽出）
    ↓
派生（転用アイデア + MVP計画 → reports/daily/）
```

---

## セットアップ（5分）

```bash
# 1. Node.js v18以上を確認
node -v

# 2. ディレクトリに移動
cd ai-income-lab

# 3. サンプル入力をコピー（input.txt は .gitignore 対象のため初回のみ必要）
#    Windows:
copy input.example.txt input.txt
#    Mac/Linux:
cp input.example.txt input.txt

# 4. 試す（追加パッケージ不要）
npm run demo
```

> **`npm run demo` は `input.example.txt` のサンプルデータで動作します。**
> 実運用の `input.txt` があっても一時退避・実行後に復元するため、実運用データは破壊されません。
> ただし、クローン直後は `input.example.txt` のコピーで始める必要はありません（demo が自動で使います）。

---

## 基本コマンド

| コマンド | 内容 | 所要時間 |
|---------|------|---------|
| `npm run demo` | `input.example.txt` のサンプルで全パイプラインを試す（実運用データ非依存） | 30秒 |
| `npm run collect` | GitHub + HN からネタを自動収集 | 2〜5分 |
| `npm run input` | 収集候補から input.txt 下書きを生成 | 5秒 |
| `npm run evaluate` | input.txt を評価して analysis.md を生成 | 10秒 |
| `npm run daily` | evaluate → report → アイデア生成 まで一括実行 | 30秒 |
| `npm run full` | collect → input 下書きまで一括実行 | 2〜5分 |

---

## 5分でわかる使い方

### パターン A：毎日の運用（推奨）

```bash
# 1. ネタを input.txt に貼る（任意のエディタで）
# ── 形式：--- で区切って1件ずつ ──
# [タイトル]
# https://url
# 概要・メモ

# 2. 評価 + レポート生成
npm run daily

# 3. 結果を確認
# → reports/daily/YYYY-MM-DD-ideas.md
# → analysis.md
```

### パターン B：自動収集から始める

```bash
# 1. キーワードを確認（任意で編集）
# → data/sources/keywords.json

# 2. GitHub + HN からネタを収集
npm run collect       # 2〜5分（GitHub は初回のみ時間がかかる）

# 3. 上位候補から下書きを生成
npm run input
# → data/collected/input_draft.txt

# 4. 下書きを input.txt にコピーして評価
copy data\collected\input_draft.txt input.txt
npm run daily
```

---

## 出力ファイル一覧

| ファイル | 内容 |
|---------|------|
| `analysis.md` | 評価レポート（採用/保留/不採用 + 転用案） |
| `results/cases.csv` | 評価済み事例データベース |
| `results/ideas.csv` | 派生アイデアDB（転用先・MVP・収益化方法） |
| `reports/daily/YYYY-MM-DD.md` | スコアリングレポート |
| `reports/daily/YYYY-MM-DD-ideas.md` | 派生アイデアレポート（ジャンル別TOP3） |
| `data/research_log.md` | 評価履歴の累積ログ |
| `data/collected/normalized_sources.json` | 正規化済みソースDB |

---

## input.txt の書き方

```
---
[タイトル（自由記述）]
https://github.com/example/repo

概要をここに書く。
転用できそうな本質、注意点、メモなど自由に。
transfer_hint: 〇〇の構造を△△に転用できる。
---
[次のネタのタイトル]
https://...
```

- `---` で1件ずつ区切る
- URL は自動検出
- `transfer_hint:` フィールドがあると転用案の精度が上がる
- コメント行（`#`）は無視される

---

## 評価結果の見方

### decision（判定）

| 判定 | 意味 |
|-----|------|
| ✅ 採用 | Claude Code で2時間以内に MVP を作れる水準 |
| ⏸️ 保留 | 調査継続。直接試すには情報不足 |
| ❌ 不採用 | 転用価値が低い、または高リスク |

### adoption_type（採用タイプ）

| タイプ | 意味 |
|-------|------|
| 🟢 直接採用 | そのまま小さく検証できる |
| 🟡 構造採用 | 直接実行は危険だが本質に転用価値がある |
| 🔵 参考 | 市場観察・比較対象として保存 |
| ⚫ 不採用 | 新規性・転用価値が低い |

---

## ファイル構成

```
ai-income-lab/
├── input.txt                  ← ここにネタを貼る（毎回更新）
├── analysis.md                ← 最新の評価レポート（自動生成）
├── data/
│   ├── sources/
│   │   ├── keywords.json      ← 収集キーワード設定
│   │   └── urls.txt           ← 手動URL貼り付け場所
│   ├── collected/
│   │   ├── raw_sources.json   ← 収集済み生データ
│   │   ├── normalized_sources.json ← スコアリング済みDB
│   │   └── input_draft.txt    ← 自動生成された input.txt 下書き
│   └── research_log.md        ← 評価履歴の累積ログ
├── results/
│   ├── cases.csv              ← 評価済み事例DB
│   └── ideas.csv              ← 派生アイデアDB
├── reports/daily/             ← 日次レポート
├── scripts/                   ← 各処理スクリプト
├── docs/                      ← ドキュメント
│   ├── quickstart.md          ← 5分で始める手順
│   ├── workflow.md            ← 全体ワークフロー図解
│   ├── use_cases.md           ← 転用事例・ユースケース集
│   └── product_copy.md        ← 販売ページ用コピー
└── prompts/                   ← Claude/ChatGPT 用プロンプト集
```

---

## カスタマイズ

### 収集キーワードを変える

`data/sources/keywords.json` を編集します：

```json
{
  "core_keywords": ["claude code", "ai agent", "micro saas", ...],
  "monetization_keywords": ["template", "subscription", "gumroad", ...]
}
```

### 転用先ジャンルを増やす

`scripts/idea.js` の `TEMPLATES` 配列に新しいジャンルを追加できます。

### 評価基準を調整する

`scripts/evaluate_idea.js` の `DANGER_RULES` と `SAFE_BONUSES` でスコアリングを変更できます。

---

## 注意事項

- **投資助言ではありません。** XAUUSD・MT5・Polymarket 関連のアイデアは「情報整理・学習用途」です
- **自動投稿・自動売買は実装していません。** コンテンツ下書き生成まで。投稿は人間が確認後に手動で行います
- **収益を保証しません。** 本ツールはリサーチ・アイデア整理のためのものです

---

## 詳細ドキュメント

- [クイックスタート](docs/quickstart.md) — 5分で始める手順
- [ワークフロー図解](docs/workflow.md) — 全体の流れと各スクリプトの関係
- [転用ユースケース集](docs/use_cases.md) — 実際の活用パターン
- [v2 設計ドキュメント](docs/ai-income-lab-v2.md) — 技術仕様
