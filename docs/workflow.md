# ワークフロー図解

## 全体の流れ

```
┌─────────────────────────────────────────────────────────────────┐
│  情報収集フェーズ（週1〜2回）                                         │
│                                                                   │
│  GitHub Search API ──┐                                            │
│  HN Algolia API ─────┼─→ raw_sources.json                        │
│  urls.txt（手動） ────┘       ↓                                    │
│                         normalize_sources.js                      │
│                               ↓                                   │
│                         normalized_sources.json（スコア順）         │
│                               ↓                                   │
│                         build_input_draft.js                      │
│                               ↓                                   │
│                         input_draft.txt（TOP10の下書き）            │
└─────────────────────────────────────────────────────────────────┘
                                ↓ 人間がレビュー・編集
┌─────────────────────────────────────────────────────────────────┐
│  評価フェーズ（毎日）                                                │
│                                                                   │
│  input.txt                                                        │
│      ↓                                                            │
│  evaluate_idea.js（v2.1）                                         │
│      ├─ カテゴリ分類（13カテゴリ）                                    │
│      ├─ 証拠強度評価（高/中/低）                                     │
│      ├─ 赤フラグ検出（12パターン）                                    │
│      ├─ 採用スコア計算（0〜100点）                                    │
│      ├─ 採用タイプ判定（直接採用/構造採用/参考/不採用）                  │
│      └─ transfer_hint から転用案生成                                 │
│                                                                   │
│  出力：                                                            │
│      ├─ analysis.md（評価レポート）                                  │
│      ├─ results/cases.csv（v1互換フォーマット）                       │
│      └─ data/research_log.md（累積ログ）                            │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│  レポート生成フェーズ（毎日）                                          │
│                                                                   │
│  results/cases.csv                                                │
│      ↓                                                            │
│  report.js  →  reports/daily/YYYY-MM-DD.md                       │
│      ↓                                                            │
│  idea.js    →  results/ideas.csv                                  │
│             →  reports/daily/YYYY-MM-DD-ideas.md                  │
│                （ジャンル別TOP3 + XAUUSDバイアスチェック）             │
└─────────────────────────────────────────────────────────────────┘
```

---

## npm スクリプトと対応処理

```
npm run demo    = evaluate_idea.js → report.js → idea.js
npm run full    = collect_github.js → collect_hn.js → normalize_sources.js → build_input_draft.js
npm run collect = collect_github.js → collect_hn.js → normalize_sources.js
npm run input   = build_input_draft.js
npm run daily   = evaluate_idea.js → report.js → idea.js（demo と同じ）
npm run evaluate= evaluate_idea.js のみ
```

---

## カテゴリ一覧（13種）

### v2.1 新カテゴリ（英語ID → 日本語表示名）

| カテゴリID | 表示名 | 例 |
|-----------|-------|-----|
| `AI_AGENT_OS_OR_SKILL_REPO` | 業務AIスキルOS | gstack, awesome-claude-skills, n8n starter kit |
| `PLATFORM_ENGAGEMENT_PORTFOLIO` | 参加型コンテンツ量産 | Fortnite UEFN, Roblox, YouTube Shorts |
| `MULTI_PLATFORM_PRODUCT_REPURPOSING` | マルチ販路展開 | EC 5プラットフォーム、BOOTH+Gumroad同時販売 |
| `AI_ASSET_CATALOG` | AI素材カタログ | Suno+Claude AI音楽カタログ |
| `AI_PERSONA_CHARACTER_SYSTEM` | AIキャラ運用システム | AI人格・VTuber・ゲームNPC |

### v1 既存カテゴリ

| カテゴリ | 表示名 | 例 |
|---------|-------|-----|
| `SEO/コンテンツ` | SEOコンテンツ | ブログ記事自動生成・SEOチェック |
| `SNS自動化` | SNS自動化 | X/Instagram 投稿下書き生成 |
| `Polymarket` | Polymarket観察 | 予測市場データ収集・可視化 |
| `AI画像販売` | AI画像販売 | Booth/Etsy AI画像カタログ |
| `情報商材` | 情報商材（観察用） | 構造研究のみ |
| `SaaS/ツール` | 小型SaaS/ツール | CLI ツール・Chrome 拡張 |

---

## スコアリングの仕組み（evaluate_idea.js）

### 採用スコア（0〜100点）

```
証拠強度（0〜25点）: GitHub URL / スクリーンショット / 動画 / 決済証拠
リスクの低さ（0〜25点）: 赤フラグの有無・数
Claude Code実装可能性（0〜25点）: API/Python/workflow 言及
市場妥当性（0〜25点）: 既知カテゴリ一致・需要ワード
カテゴリボーナス（+8点）: 既知カテゴリに分類できた場合
```

### 赤フラグ（12パターン）

blocking（直接採用を阻止）:
- `adult_content_risk`: 成人向けコンテンツ
- `deception_risk`: 欺瞞・なりすまし
- `platform_ban_risk`: プラットフォームBANリスク
- `legal_ip_violation`: 著作権/商標侵害
- `auto_trading`: 自動売買

warning（スコア減点のみ）:
- `legal_ip_risk`: 著作権警告
- `platform_policy_risk`: 規約変更リスク
- `revenue_claim_risk`: 収益主張の信頼性低
- `quality_saturation_risk`: 品質・競争飽和
- `evidence_weakness`: 証拠の弱さ
- `telegram_redirect`: Telegram誘導（文脈あり）
- `line_redirect`: LINE誘導
- `exaggeration_claim`: 誇大表現

---

## カテゴリ判定の仕組み

v2.3.5 から「コアテキスト」と「転用テキスト」を分離しています：

```
全テキスト
├── コアテキスト（カテゴリ判定に使用）
│   ├── タイトル
│   ├── URL
│   ├── 情報源
│   ├── 概要
│   └── 収益化の可能性
└── 転用テキスト（カテゴリ判定から除外）
    ├── 転用できそうな本質
    ├── transfer_hint
    ├── AI Income Lab投入理由
    └── 怪しい点・注意点
```

これにより「転用先として Polymarket と書いた → Polymarket カテゴリに誤分類」が防止されます。

---

## データフロー詳細

```
input.txt
    ↓ split by \n---\n
[Item1] [Item2] [Item3] ...
    ↓ parseBlock()
title / url / body
    ↓ extractCoreText()
coreText（転用ヒント除外）
    ↓ detectCategory()
category（13種から最多キーワードマッチで選択）
    ↓ evalEvidence(), detectRedFlags(), evalRisk()
evidence_strength / red_flags / risk_level
    ↓ calcAdoptionScore()
adoption_score（0〜100）
    ↓ determineDecision(), determineAdoptionType()
decision / adoption_type
    ↓ extractTransferHint(), generateTransferIdeas()
transfer_ideas（転用案3件）
    ↓ writeCasesCSV()
results/cases.csv（v1互換18列）
    ↓ idea.js
results/ideas.csv（19列 × N件）
reports/daily/YYYY-MM-DD-ideas.md
```
