# リリースチェックリスト

GitHub 公開・BOOTH/note 配布前に必ず確認してください。

---

## 1. npm run demo の安全確認

```bash
npm run demo
```

- [ ] エラーなく完了する
- [ ] `input.example.txt` のサンプル3件（n8n / awesome-claude-skills / gstack）だけが評価される
- [ ] 実運用4件（enescingoz等）は **出ない**
- [ ] 実行後に元の `input.txt` が復元されている（コンソールに「♻️ 実運用 input.txt を復元しました」が出る）
- [ ] `analysis.md` が生成されている（内容はサンプルデータ由来）

---

## 2. git status 確認

```bash
git status
```

以下のファイルが **「Untracked files」に出ていないこと**を確認する：

- [ ] `input.txt` — 出ていない
- [ ] `analysis.md` — 出ていない
- [ ] `results/cases.csv` — 出ていない
- [ ] `results/ideas.csv` — 出ていない
- [ ] `reports/daily/YYYY-MM-DD.md` — 出ていない
- [ ] `data/research_log.md` — 出ていない
- [ ] `data/sources/urls.txt` — 出ていない
- [ ] `data/collected/raw_sources.json` — 出ていない
- [ ] `data/collected/normalized_sources.json` — 出ていない
- [ ] `data/collected/input_draft.txt` — 出ていない
- [ ] `data/collected/selected_input_draft.txt` — 出ていない
- [ ] `*.backup.js`, `*.bak.txt` — 出ていない

---

## 3. 公開してよいファイル（Git に含める）

| ファイル/ディレクトリ | 内容 |
|--------------------|------|
| `README.md` | Starter Kit の説明・使い方 |
| `package.json` | npm scripts 定義 |
| `CLAUDE.md` | プロジェクト設計方針 |
| `.gitignore` | 除外ルール（これ自体は公開する） |
| `input.example.txt` | サンプル入力（3件の安全なデモデータ） |
| `scripts/*.js` | 全スクリプト（バックアップ除く） |
| `data/categories.json` | カテゴリ定義 |
| `data/sources/keywords.json` | 収集キーワード設定 |
| `data/sources/urls.example.txt` | 手動URL記入例 |
| `data/raw/TEMPLATE.md` | 入力テンプレート |
| `data/raw/.gitkeep` | ディレクトリ構造保持 |
| `data/samples/sample-research.md` | v1 サンプルデータ |
| `data/collected/.gitkeep` | ディレクトリ構造保持 |
| `data/processed/.gitkeep` | ディレクトリ構造保持 |
| `results/.gitkeep` | ディレクトリ構造保持 |
| `reports/daily/.gitkeep` | ディレクトリ構造保持 |
| `docs/*.md` | ドキュメント全般 |
| `prompts/*.md` | プロンプトテンプレート |
| `.claude/agents/*.md` | エージェント定義 |
| `.claude/skills/*/SKILL.md` | スキル定義 |

---

## 4. 公開してはいけないファイル（.gitignore 対象）

| ファイル | 理由 |
|---------|------|
| `input.txt` | 実運用リサーチネタ（個人情報を含む可能性） |
| `analysis.md` | 実行結果（実運用データ由来） |
| `results/cases.csv` | 評価済み実データ |
| `results/ideas.csv` | 実運用アイデアDB |
| `reports/daily/YYYY-MM-DD*.md` | 実運用レポート |
| `data/research_log.md` | 評価履歴（個人URLを含む） |
| `data/sources/urls.txt` | 個人URL集 |
| `data/collected/raw_sources.json` | 収集済み生データ（1000件超） |
| `data/collected/normalized_sources.json` | スコアリング済みDB |
| `data/collected/input_draft.txt` | 自動生成下書き |
| `data/collected/selected_input_draft.txt` | 個人選別済みデータ |
| `data/raw/YYYY-MM-DD*.md` | 日付付きリサーチファイル |
| `*.backup.js`, `*.bak.txt` | バックアップファイル |
| `.env`, `*.token` | 認証情報 |

---

## 5. 実運用データ混入チェック

```bash
# git add -A した場合に含まれるファイルを確認（実行はまだしない）
git add --dry-run -A
```

以下が出力に含まれていないことを確認する：

- [ ] `input.txt`
- [ ] `analysis.md`
- [ ] `data/research_log.md`
- [ ] `data/collected/raw_sources.json`
- [ ] `results/cases.csv`
- [ ] `reports/daily/2026-*.md`

---

## 6. README / quickstart の確認

- [ ] `README.md` に `copy input.example.txt input.txt` の手順がある
- [ ] `docs/quickstart.md` に Step 0（input.txt コピー）がある
- [ ] `npm run demo` の説明に「input.example.txt を使う」と明記されている
- [ ] 「怪しい AI で稼ぐ商材」に見えない説明になっている
- [ ] 投資助言・収益保証でないことが明記されている

---

## 7. BOOTH/note 配布 ZIP 作成前チェック

ZIP に含めるファイルを手動確認：

```bash
# git 管理下のファイルのみを ZIP 化する場合
git archive HEAD --format=zip -o ai-income-lab-starter-kit.zip
```

- [ ] ZIP に `input.txt` が含まれていない
- [ ] ZIP に `data/research_log.md` が含まれていない
- [ ] ZIP に `data/collected/*.json` が含まれていない
- [ ] ZIP に `results/cases.csv` が含まれていない
- [ ] `input.example.txt` が ZIP に含まれている
- [ ] `README.md` が ZIP に含まれている
- [ ] `docs/quickstart.md` が ZIP に含まれている

---

## 8. 初回公開コマンド（GitHub）

```bash
# 現在の状態を確認
git status

# 公開対象ファイルをステージ
git add -A

# ステージ内容を最終確認
git diff --staged --name-only

# コミット
git commit -m "feat: AI Income Lab Starter Kit v2.3.9

- Collector pipeline (GitHub + HN)
- Evaluator with 13 categories and 12 red-flag patterns
- Idea generator with 10 transfer markets
- Safe demo mode (run_demo.js)
- Full documentation (quickstart / workflow / use_cases)"

# GitHub にプッシュ（リモートを設定してから）
# git remote add origin https://github.com/YOUR_USERNAME/ai-income-lab.git
# git push -u origin master
```

---

## 9. 公開後の確認

- [ ] GitHub の `<> Code` タブでファイル一覧を確認
- [ ] `input.txt` が存在しないことを確認
- [ ] `analysis.md` が存在しないことを確認
- [ ] `data/collected/` に `.gitkeep` だけが存在することを確認
- [ ] `README.md` が正しく表示されている
- [ ] `npm run demo` の手順を別マシンで試す（クローン→コピー→実行）
