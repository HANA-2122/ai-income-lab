# Revenue Research Skill

## 説明

`data/raw/` と `data/samples/` に保存されたリサーチ素材を読み込み、
AI自動化収益化事例を分類・要約するスキル。

## 使い方

Claude Code で `/revenue-research` と入力すると起動します。

引数として分析したいファイルを指定できます:
```
/revenue-research data/raw/2026-05-02-twitter.md
```

引数なしで実行すると `data/raw/` 全体を分析します。

## 実行内容

1. 指定ファイル（または `data/raw/` 全体）を読み込む
2. `## Case N:` 形式で分割されたブロックを検出
3. 各ブロックから以下を抽出:
   - 投稿者・URL・日付
   - 収益主張と証拠の強さ
   - 使用ツールとカテゴリ
4. `scripts/score.js` のルールでスコアリング
5. `results/cases.csv` に追記
6. 追加された事例のサマリーを表示

## 出力例

```
✅ 3件の新規事例を cases.csv に追加しました

追加事例:
1. [SEO/コンテンツ] Claude Code × SEOツール — 72点（詳細調査）
2. [SNS自動化] 投稿自動生成受託 — 68点（詳細調査）
3. [情報商材] AI月収100万講座 — 12点（スキップ・高リスク）
```

## 関連ファイル

- `scripts/analyze.js` — このスキルが呼び出すメインスクリプト
- `scripts/score.js` — スコアリングロジック
- `prompts/daily-research.md` — 収集時のプロンプトテンプレート
- `CLAUDE.md` — データ形式の仕様
