# クイックスタート — 5分で始める

## 前提条件

- Node.js v18 以上（`node -v` で確認）
- Git（クローンする場合）
- インターネット接続（collect コマンド実行時のみ）

追加パッケージは不要です（`npm install` 不要）。

---

## Step 0: input.txt を準備する（初回のみ）

`input.txt` は `.gitignore` 対象のため、リポジトリには含まれていません。
サンプルファイルをコピーして使います：

```bash
# Windows
copy input.example.txt input.txt

# Mac/Linux
cp input.example.txt input.txt
```

> `input.txt` は自分のリサーチネタを蓄積する「作業ファイル」です。
> 誤って GitHub に公開されないよう .gitignore で除外しています。

---

## Step 1: サンプルで動作確認（1分）

`npm run demo` は **`input.example.txt` のサンプルデータ**を使って動作します。
実運用の `input.txt` がすでにある場合も、自動で一時退避・実行後に復元するため安全です。

```bash
npm run demo
```

内部で以下が行われます：
1. 実運用 `input.txt` があれば一時バックアップ
2. `input.example.txt` をデモ用に `input.txt` としてコピー
3. evaluate → report → idea を実行
4. 元の `input.txt` を復元（エラー時も必ず復元）

以下が生成されます：
- `analysis.md` — 評価レポート
- `results/cases.csv` — 評価済みデータ
- `results/ideas.csv` — 派生アイデア
- `reports/daily/YYYY-MM-DD-ideas.md` — 日次アイデアレポート

---

## Step 2: 自分のネタを評価する（2分）

### 方法A：手で貼る（最速）

`input.txt` をエディタで開き、以下の形式でネタを追加します：

```
---
[タイトル]
https://url

概要や気になる点を自由に書く。
transfer_hint: 〇〇の構造を△△に転用できる。
---
```

保存したら：

```bash
npm run daily
```

### 方法B：自動収集から選ぶ

```bash
# GitHub + Hacker News から候補を収集
npm run collect

# 上位候補から input.txt の下書きを生成
npm run input

# 下書きを確認・編集してから input.txt にコピー
# Windows:
copy data\collected\input_draft.txt input.txt

# Mac/Linux:
cp data/collected/input_draft.txt input.txt

# 評価実行
npm run daily
```

---

## Step 3: 結果を読む（2分）

### analysis.md を開く

各ネタの評価結果が出ます：

- **採用 🟢** → `Claude Codeで2時間以内のMVPを作って反応を確認する`
- **保留 🔵** → `research_log.mdに保存。類似事例が増えたら再評価する`
- **不採用 ⚫** → `スキップ`

### reports/daily/YYYY-MM-DD-ideas.md を開く

ジャンル別TOP3のアイデアが出ます。各アイデアには：

- 転用先ジャンル
- 優先度スコア
- MVP の具体的な内容
- 成功指標
- 期待収益

---

## よくある質問

**Q: `npm run collect` が遅い**
A: GitHub の非認証モードは10req/分の制限があり、12キーワードで約90秒かかります。
`GITHUB_TOKEN` を設定すると約30秒になります：
```bash
# Windows
set GITHUB_TOKEN=ghp_xxxxxx

# Mac/Linux
export GITHUB_TOKEN=ghp_xxxxxx
```

**Q: input.txt に何件入れていいか**
A: 1〜10件が推奨です。件数が多いと ideas.csv の重複排除後の件数が減ります。

**Q: 同じURLを2回評価すると「重複」と出る**
A: `data/research_log.md` に蓄積された過去評価のURLと照合しているためです。
意図的な再評価の場合は無視して構いません。

**Q: カテゴリ分類がおかしい**
A: `transfer_hint:` フィールドに転用先キーワード（Polymarket, MT5 等）を書くと
カテゴリ判定が影響を受ける場合があります。
「概要」「情報源」「収益化の可能性」に元ネタの本質を書くと精度が上がります。

**Q: Windows で `copy` コマンドが動かない**
A: PowerShell を使っている場合は `Copy-Item` を使います：
```powershell
Copy-Item data\collected\input_draft.txt input.txt
```
