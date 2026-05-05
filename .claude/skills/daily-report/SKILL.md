# Daily Report Skill

## 説明

`results/cases.csv` から日次レポートを生成するスキル。
毎日の分析結果をMarkdown形式でまとめ、次のアクションを明確にします。

## 使い方

```
/daily-report                  # 今日の日次レポートを生成
/daily-report --date 2026-05-01  # 特定日のデータでレポート生成
/daily-report --preview        # レポートをターミナルにプレビュー
```

## 実行内容

1. `results/cases.csv` を読み込む
2. スコア順にソートして上位事例を選定
3. リスク事例を分離して警告リストを作成
4. カテゴリ別の集計・パターン分析を実行
5. 小実験案・翌日の収集候補を生成
6. `reports/daily/YYYY-MM-DD.md` に出力

## レポートの構成

```
# AI収益化事例 日次レポート — YYYY-MM-DD

## 今日の有望事例 TOP5
## 怪しい事例 TOP5（要注意）
## 深掘り候補 TOP3
## 多かった収益化パターン
## 自分が試すべき小実験案
## 明日集めるべき情報
## スコア分布
```

## npm コマンドとの対応

このスキルは `npm run report` と同等の処理を行います。
毎日の運用では `npm run daily`（= analyze + report）を実行してください。

## カスタマイズ

レポートの形式を変更したい場合は `scripts/report.js` を編集してください。

主なカスタマイズポイント:
- `buildReport()` — レポート全体の構成
- `genExperiments()` — 小実験案の生成ロジック
- `genTomorrow()` — 翌日の収集候補生成ロジック

## 関連ファイル

- `scripts/report.js` — このスキルが呼び出すメインスクリプト
- `results/cases.csv` — 入力データ
- `reports/daily/` — 出力先ディレクトリ
