# 転用ユースケース集

AI Income Lab で評価された事例がどのように転用されたか・転用できるかの参考集です。

---

## ユースケース 1：業務AIスキルOS の構築

### 元ネタ
`garrytan/gstack` — Garry Tan の Claude Code セットアップ（CEO/Designer/Eng Manager 等の23ツール）

### 抽出した本質
「Claude Code に複数の専門役割を持たせ、1人でマルチロールチームを運用する」

### AI Income Lab での転用例

**AI Income Lab 自体への適用（実装済み）:**
```
.claude/agents/
├── revenue-researcher.md    # 収益化事例を分類・要約
├── scam-detector.md         # 誇大表現・リスクを検出
├── builder-planner.md       # 有望事例をMVPタスクに変換
├── pattern-miner.md         # 本質パターンを抽出
└── idea-transformer.md      # アイデアを転用先に変換
```

**外部転用：MT5トレーダー向けClaude Code OS（例）:**
```
.claude/agents/
├── chart-analyst.md         # チャートパターンを解析
├── risk-checker.md          # ポジションリスクを計算
├── trade-logger.md          # トレード記録を整理
└── mt5-doc-writer.md        # インジケーター説明文を生成
```

### 収益化の方向
1. MT5/SEO/Polymarket 特化の Claude Code OS テンプレートを GitHub 公開
2. Zenn/note で使い方記事を投稿（無料）
3. 「ドメイン別 Claude Code OS パック」として BOOTH/Gumroad で販売（500〜3000円）

---

## ユースケース 2：n8n ワークフローのドメイン特化

### 元ネタ
`n8n-io/self-hosted-ai-starter-kit` — セルフホスト型AI自動化ワークフローOS（Stars 14K）

### 抽出した本質
「汎用ワークフローテンプレートを特定ドメインに特化してスターターキット化する」

### 転用例

**AI Income Lab パイプラインを n8n で視覚化（実験候補）:**
```
n8n workflow:
  ① GitHub Search → raw_sources.json に保存
  ② HN Algolia → 同上
  ③ normalize_sources.js を実行
  ④ スコア上位10件を Slack/Discord に通知
  ⑤ 人間が選んで input.txt を更新
  ⑥ evaluate_idea.js を実行
  ⑦ ideas.csv を Notion DB に同期
```

**MT5日次分析スターターキット（販売候補）:**
```
n8n workflow:
  ① 主要経済指標の発表時刻を取得
  ② XAUUSD の日次価格データを取得
  ③ Claude Code で分析下書き Markdown を生成
  ④ 人間が確認後、note/X に手動投稿
```

### 収益化の方向
1. GitHub で「MT5 分析自動化 n8n テンプレート」を公開（Stars 獲得）
2. Zenn で使い方記事を投稿（無料）
3. カスタマイズ・設定支援を受託（時給制）

---

## ユースケース 3：Claude Skills パックの作成・販売

### 元ネタ
`ComposioHQ/awesome-claude-skills` — Claude Skills キュレーション集

### 抽出した本質
「Claude 用スキルをドメイン別にカタログ化し、再利用できる知識部品として提供する」

### 転用例

**AI Income Lab に既に実装されているスキル:**
```
.claude/skills/
├── revenue-research/SKILL.md   # 収益化事例を分類
├── risk-check/SKILL.md         # リスク確認
└── daily-report/SKILL.md       # 日次レポート生成
```

**追加できるスキル案:**
```
.claude/skills/
├── mt5-indicator-explainer/    # MT5インジの動作説明生成
├── polymarket-observer/        # 予測市場データ収集
├── seo-article-checker/        # SEO記事チェック
└── scam-pattern-detector/      # 情報商材パターン検出
```

### 収益化の方向
1. ドメイン別 Skill パック（MT5版 / SEO版 / Polymarket版）を GitHub で公開
2. Zenn で「Claude Code スキルの作り方」チュートリアル記事を書く
3. 有料スキルパック（500〜2000円）として BOOTH で販売

---

## ユースケース 4：AI素材カタログ運営

### 元ネタ
`Claude + Suno でAI音楽カタログを作り複数販路で販売するモデル`

### 抽出した本質
「AI生成物を単発ではなく、検索・販売・ライセンス可能な素材カタログ資産にする」

### 転用例

**AI Income Lab 関連素材の横展開:**

```
1つの評価結果
    ↓ Claude Code で変換
├── X 投稿スレッド（140字×5ツイート）
├── Zenn 記事（1000〜2000字）
├── YouTube Shorts スクリプト
├── BOOTH デジタル教材（PDF/Markdown）
└── Gumroad テンプレートパック
```

### 収益化の方向
1. AI Income Lab の評価結果から「週次まとめ X スレッド」を手動投稿
2. 月次で note 記事にまとめてフォロワー獲得
3. フォロワーが増えたら有料教材・メンバーシップへ誘導

---

## ユースケース 5：情報商材パターンの研究（反面教師）

### 元ネタ
「AIを使うだけで一晩で月100万！」系の投稿

### 抽出した本質（逆から見る）
「誇大表現 + 証拠なし + LINE誘導 + 高額講座」= 情報商材テンプレート

### AI Income Lab での活用
- `scam-detector.md` エージェントの検出精度向上に活用
- `evaluate_idea.js` の赤フラグルールの参考に活用
- **絶対にやらないこと**: 同じ手法で情報商材を作る・販売する

---

## 転用パターンの整理

| パターン | 説明 | 例 |
|---------|------|-----|
| **周辺ツール化** | 主要ツールを補助するサブツール | n8n + Claude Code 連携スクリプト |
| **ドメイン特化** | 汎用ツールを特定領域向けに再設計 | MT5専用 Claude Code OS |
| **日本語化** | 英語圏ツールを日本語コンテキストで解説 | n8n テンプレート日本語解説 |
| **カタログ化** | 類似事例を集めてリスト化 | Claude Skills 国内事例集 |
| **教材化** | 実装手順を初心者向けに整理 | Zenn/note チュートリアル |
| **横展開** | 1事例から複数フォーマットに展開 | 記事 → X スレッド → YouTube |
