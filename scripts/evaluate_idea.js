#!/usr/bin/env node
// evaluate_idea.js — v2.1
// Changes from v2.0:
//   - 5 new categories (PLATFORM_ENGAGEMENT_PORTFOLIO, AI_AGENT_OS_OR_SKILL_REPO,
//     MULTI_PLATFORM_PRODUCT_REPURPOSING, AI_ASSET_CATALOG, AI_PERSONA_CHARACTER_SYSTEM)
//   - transfer_hint field extraction → used as primary source for transfer ideas
//   - 8 categorised red flags with blocks_direct property
//   - Improved evidence scoring (repo URL vs mention, prompt examples, etc.)
//   - Risk level no longer forces 構造採用 alone; only blocks_direct flags do
//   - Improved console output (8 fields per item)
'use strict';

const fs   = require('fs');
const path = require('path');

// ── Paths ─────────────────────────────────────────────────────
const ROOT          = path.join(__dirname, '..');
const INPUT_FILE    = path.join(ROOT, 'input.txt');
const ANALYSIS_FILE = path.join(ROOT, 'analysis.md');
const LOG_FILE      = path.join(ROOT, 'data', 'research_log.md');
const CAT_FILE      = path.join(ROOT, 'data', 'categories.json');

// ── Extended categories (new in v2.1) ─────────────────────────
const EXTENDED_CATEGORIES = [
  {
    id: 8, name: 'PLATFORM_ENGAGEMENT_PORTFOLIO',
    keywords: [
      'fortnite', 'uefn', 'roblox', 'engagement payout', 'creator economy',
      'engagement収益', 'creator fund', 'verse', 'エンゲージメント配分',
      'creator economy 2.0', 'youtube shorts', 'studio income',
      'コンテンツ量産ポートフォリオ', 'プラットフォーム収益',
    ],
    transfer_hints: [
      'プラットフォーム内 engagement 収益をAIで量産・改善するポートフォリオ運用モデルを設計する',
      'Fortnite以外（Roblox・YouTube Shorts・SEOサイト・AIツール集）への横展開を検証する',
      'コンセプト・コード雛形・メタデータ・改善案をClaude Codeでバッチ生成し、複数タイトルのA/Bテストを高速化する',
    ],
    claude_code_angle: 'コンセプト生成・Verse/スクリプト雛形・メタデータ・分析改善提案のバッチ自動生成スクリプト',
    risk_note: 'プラットフォーム規約変更・配分率変更・審査・アルゴリズム変動リスクあり。1本成功より複数ポートフォリオの分散が重要。',
  },
  {
    id: 9, name: 'AI_AGENT_OS_OR_SKILL_REPO',
    keywords: [
      'product-marketing-context', 'skill.md', 'context.md', 'agent os',
      'エージェント用repo', 'skill repo', '139', 'growth tactics', 'cro',
      'programmatic seo', 'tool registry', 'switching forces',
      'spiky pov', 'マーケティングos', '業務os', 'knowledge base for ai',
      // v2.3.5追加: Claude Code OS / gstack / n8n スターターキット系
      'claude code', 'claude skills', 'claude skill', 'awesome-claude-skills',
      'gstack', 'agent harness', 'skill pack', 'role-based', 'multi-role',
      'マルチロールos', 'ai agent os', 'specialist agents', 'role agents',
      'n8n', 'self-hosted ai', 'starter kit', 'workflow template',
      'automation template', 'template catalog', 'n8n workflow',
    ],
    transfer_hints: [
      '専門家の思考順序をmarkdown化し、AIが毎回読んで実行できる業務OS（context.md構造）を設計する',
      'AI Income Lab自体に income-context.md / idea-evaluation-context.md / red-flags.md を導入する',
      '投資リサーチ・SNS運用・SEO記事制作・MT5インジ販売の各ドメインにスキルファイルを作る',
    ],
    claude_code_angle: 'context.md / skill.md / red-flags.md の骨格生成と自分の業務ドメインへの適用CLIスクリプト',
    risk_note: 'スキルファイルの品質・文脈依存が高い。実際の顧客データ・計測指標がないと一般論にとどまる。',
  },
  {
    id: 10, name: 'MULTI_PLATFORM_PRODUCT_REPURPOSING',
    keywords: [
      'amazon merch', 'etsy', 'gumroad', 'shopify', 'redbubble', 'pod',
      'print on demand', '複数プラットフォーム', 'multi-platform',
      '5プラットフォーム', '複数平台', '販路展開', '複数の商品形態', '複数販路',
    ],
    transfer_hints: [
      '1つのアイデアを各プラットフォームの購買文脈に合わせた複数商品形態へ変換する仕組みを設計する',
      'AI Income Labの1つのネタを X投稿・SEO記事・Gumroad商品・YouTube動画・テンプレ販売へ展開する',
      '商品説明・SEO文・価格設定・出品準備の自動化パイプラインをClaude Codeで構築する',
    ],
    claude_code_angle: '1アイデアを複数フォーマット（listing・記事・投稿文・商品説明）へ変換するバッチスクリプト',
    risk_note: '商標・著作権・低品質量産・プラットフォーム競合・集客コストに注意。収益主張は実測で検証する。',
  },
  {
    id: 11, name: 'AI_ASSET_CATALOG',
    keywords: [
      'suno', 'AI音楽', '音楽カタログ', 'stock music', 'audiojungle', 'pond5',
      'sync license', 'asset catalog', '素材カタログ', 'ストリーミング収益',
      'royalty free', 'streaming revenue', 'ai music', 'ai楽曲', 'distrokid',
    ],
    transfer_hints: [
      'AI生成物を単発作品ではなく検索・販売・ライセンス可能な素材カタログ資産として運用する',
      '音楽以外（AI画像素材・効果音・動画テンプレ・Canvaテンプレ・プロンプト集）への横展開を検討する',
      'プロンプトテンプレート集をGitHub公開→認知獲得→有料カタログへ転換する設計をする',
    ],
    claude_code_angle: 'プロンプト自動生成・ジャンル別バッチ生成・メタデータ自動作成スクリプト',
    risk_note: 'AI生成物の著作権帰属・プラットフォームごとの商用利用条件・競争飽和・品質選別がボトルネック。規約要確認。',
  },
  {
    id: 12, name: 'AI_PERSONA_CHARACTER_SYSTEM',
    keywords: [
      'persona.md', 'voice.md', 'brain.md', 'elevenlabs', 'キャラクター設定ファイル',
      'memory json', '記憶json', 'ai架空人物', 'ai persona', 'character system',
      'character definition', '人格継続運用', 'cronによる受信箱', 'flux.md',
    ],
    transfer_hints: [
      'キャラクターをmarkdownファイル群（persona.md/voice.md/brain.md）で定義し、記憶・声・外見・会話ルールを分離して継続運用する',
      '成人向けではなく、架空VTuber・ゲームNPC・教育キャラ・ブランド公式キャラ・カスタマーサポート人格への安全転用を設計する',
      'キャラクター設定自動生成・一貫性チェック・記憶JSON管理のCLIツールをClaude Codeで構築する',
    ],
    claude_code_angle: 'persona.md/voice.md/brain.md の自動生成・キャラクター一貫性チェック・記憶JSON管理CLIツール',
    risk_note: '架空であることの開示義務・成人向けコンテンツの法規制・欺瞞リスク・プラットフォームBAN・決済停止に注意。',
  },
];

// ── Category loader ────────────────────────────────────────────
function loadCategories() {
  const base = fs.existsSync(CAT_FILE)
    ? JSON.parse(fs.readFileSync(CAT_FILE, 'utf8')).categories
    : [];
  return [...base, ...EXTENDED_CATEGORIES];
}

// ── Input parser ───────────────────────────────────────────────
function parseInput(content) {
  // \r?\n---\r?\n で分割することで Windows CRLF にも対応
  return content.split(/\r?\n---\r?\n/).map(b => b.trim()).filter(b => b.length > 15)
    .filter(b => {
      const nonempty = b.split(/\r?\n/).filter(l => l.trim());
      return nonempty.some(l => !l.trim().startsWith('#'));
    })
    .map(parseBlock)
    .filter(Boolean);
}

function parseBlock(block) {
  // CRLF/LF 両対応
  const lines = block.split(/\r?\n/).map(l => l.trim()).filter(l => l);
  if (!lines.length) return null;
  const bracketTitle = block.match(/^\[([^\]]+)\]/m);
  const title = bracketTitle ? bracketTitle[1].trim() : lines[0];
  const urlMatch = block.match(/https?:\/\/[^\s）\)\]]+/);
  const url = urlMatch ? urlMatch[0].trim() : '';
  const body = block
    .replace(/^\[([^\]]+)\]\s*/m, '')
    .replace(urlMatch ? urlMatch[0] : '', '')
    .split(/\r?\n/).map(l => l.trim()).filter(l => l).join('\n');
  return { title, url, body, raw: block };
}

// ── transfer_hint extractor ────────────────────────────────────
function extractTransferHint(body) {
  const lines = body.split('\n');
  let collecting = false;
  const buf = [];
  for (const line of lines) {
    if (/^transfer_hint:\s*/i.test(line)) {
      collecting = true;
      buf.push(line.replace(/^transfer_hint:\s*/i, '').trim());
    } else if (collecting) {
      if (/^\s*[a-z_]+:\s/i.test(line) && line.trim().length > 0) break;
      if (line.trim()) buf.push(line.trim());
    }
  }
  return buf.length ? buf.join(' ').trim() : null;
}

// ── Transfer idea generation (transfer_hint has priority) ──────
function generateTransferIdeas(hintText, category) {
  if (hintText) {
    const sentences = hintText.split(/[。]/g).map(s => s.trim()).filter(s => s.length > 15);
    const ideas = sentences.slice(0, 2).map(s => s + '。');
    const fallback = category && category.transfer_hints && category.transfer_hints[0]
      ? category.transfer_hints[0]
      : 'このモデルの仕組みをClaude Code初心者向け記事として発信する';
    if (ideas.length < 3) ideas.push(fallback);
    return ideas.slice(0, 3);
  }
  return (category && category.transfer_hints && category.transfer_hints.length > 0)
    ? category.transfer_hints.slice(0, 3)
    : [
        '周辺ツール化：このプロセスを補助するCLIツールを作る',
        '分析ツール化：市場データを収集・可視化するスクリプト',
        'メディア化：仕組みを解説するZenn/note記事として発信',
      ];
}

// ── Evidence evaluation (v2.1: URL vs mention distinction) ─────
function evalEvidence(text) {
  // Negate "screenshot + なし" patterns within a window
  const screenshotOk = /スクリーンショット/.test(text) &&
    !/スクリーンショット.{0,20}(なし|無し|ない|ありません)/.test(text);
  const paymentOk = /stripe|paypal|振込証明|売上明細|決済画面/.test(text) &&
    !/(売上明細|振込証明|決済画面).{0,15}(なし|無し|ない)/.test(text);
  const t = text.toLowerCase();

  let score = 0;
  const signals = [];

  // High-quality: actual repo URL
  if (/github\.com\/[\w.-]+\/[\w.-]+/i.test(text))   { score += 15; signals.push('GitHub repo URL'); }
  else if (/github/i.test(t))                         { score += 10; signals.push('GitHub言及'); }

  if (/youtube\.com|youtu\.be|loom\.com|動画デモ|実稼働デモ/i.test(t)) { score += 8; signals.push('動画/デモ'); }
  if (paymentOk)                                       { score += 10; signals.push('決済証拠'); }
  if (screenshotOk)                                    { score += 7;  signals.push('スクリーンショット'); }

  // Structured evidence: file configs, scaffolding, prompts shown
  if (/persona\.md|voice\.md|brain\.md|\.md.*構成|verse scaffold|具体プロンプト.*提示|プロンプト.*提示/i.test(text)) {
    score += 5; signals.push('設定ファイル/プロンプト例');
  }
  // Specific metrics (Stars, forks, user counts, platform stats)
  if (/\b\d+\s*(stars?|フォーク|ダウンロード|mau|dau|インストール|件のレビュー)/i.test(text) ||
      /creator economy.*\d|\d+.*(?:エンゲージメント分数|配分率|セッション時間)/i.test(text)) {
    score += 5; signals.push('具体的指標');
  }
  // Steps / process described
  if (/手順|ステップ|workflow|工程|プロンプトが示|具体的な運用/i.test(t) && score > 0) {
    score += 3; signals.push('詳細手順');
  }
  if (signals.length >= 2) score += 5; // multiple evidence bonus

  // Unverifiable claim penalty
  if (/検証困難|第三者検証なし|信頼度は低|実績は検証困難/i.test(t)) score -= 5;

  const strength = score >= 15 ? '高' : score >= 8 ? '中' : '低';
  return { strength, score: Math.min(25, Math.max(0, score)), signals };
}

// ── Red flags v2.1 (8 new categorised flags + legacy) ─────────
const RED_FLAG_RULES = [
  // ── blocks_direct = true ──────────────────────────────────────
  { key: 'adult_content_risk',
    re:  /成人向け|アダルト|onlyfans|nsfw|adult.?content|18禁|性的コンテンツ/i,
    label: '成人向けコンテンツリスク',  blocks_direct: true },
  { key: 'deception_risk',
    re:  /架空人物による欺瞞|欺瞞性|利用者の錯誤|なりすまし.*欺|実在しない.*欺/,
    label: '欺瞞・なりすましリスク',    blocks_direct: true },
  { key: 'platform_ban_risk',
    re:  /プラットフォームban|垢ban|account.*terminat|凍結リスク|banリスク|決済停止リスク/i,
    label: 'プラットフォームBANリスク', blocks_direct: true },
  { key: 'legal_ip_violation',
    re:  /著作権侵害|商標侵害|copyright.*infring|trademark.*infring|無断転載|剽窃/i,
    label: '著作権/商標侵害リスク',     blocks_direct: true },
  { key: 'auto_trading',
    re:  /自動売買(?!.{0,15}(なく|ない|なし|SAFE))|SAFE_TRADING.*auto/i,
    label: '自動売買',                  blocks_direct: true },
  // ── blocks_direct = false (warnings) ─────────────────────────
  { key: 'legal_ip_risk',
    re:  /著作権(?!侵害)|商標(?!侵害|登録済)|copyright(?!.*infring)|trademark(?!.*infring)|声優音声の権利|知財/i,
    label: '著作権/商標リスク（警告）', blocks_direct: false },
  { key: 'platform_policy_risk',
    re:  /規約変更|利用規約.*リスク|platform.*rule.*change|ポリシー変更|配分率変更/i,
    label: 'プラットフォーム規約変更リスク', blocks_direct: false },
  { key: 'regulation_risk',
    re:  /金融規制|投資助言|医療行為|無登録|gambling|法的.*問題|倫理的問題/i,
    label: '法規制/倫理リスク',         blocks_direct: false },
  { key: 'revenue_claim_risk',
    re:  /\$[0-9,]+[kK]?\b.*(?:year|month|day|\/|\b)|月[0-9]+万.*(?:確実|誰でも)|爆益|overnight.*稼/i,
    label: '収益主張の信頼性低（要検証）', blocks_direct: false },
  { key: 'quality_saturation_risk',
    re:  /競争過多|過当競争|飽和|品質低下|低品質量産|削除リスク|ai.*トラック.*削除|審査が厳し|品質に届か/i,
    label: '品質・競争飽和リスク',       blocks_direct: false },
  { key: 'evidence_weakness',
    re:  /検証困難|第三者検証なし|信頼度は低|主張のみ|実績は検証困難|前提条件.*依存|不確実|信頼度.*低/i,
    label: '証拠の弱さ（要検証）',       blocks_direct: false },
  { key: 'telegram_redirect',
    // "Gmail・Telegram・Slack" のようなサービス列挙は除外し、誘導・登録・参加を意図する表現のみ検出
    re:  /telegram\s*(誘導|channel|group|へ登録|に参加|に追加|に申し込|bot.*稼|で稼ぐ)|テレグラム\s*(誘導|に参加|に登録)/i,
    label: 'Telegram誘導',              blocks_direct: false },
  { key: 'line_redirect',
    re:  /line公式|line@|lineに追加/i,
    label: 'LINE誘導',                  blocks_direct: false },
  { key: 'exaggeration_claim',
    re:  /一晩で[爆大]益|claudeに頼むだけで誰でも/,
    label: '誇大表現・即金主張',         blocks_direct: false },
  // 窃盗・マルウェア・詐欺事件（v2.4.x false positive 対策）
  { key: 'theft_malware_incident',
    re:  /\btheft\b|\bheist\b|\bcrypto.?heist\b|\bmalware\b|\brug.?pull\b|\bmalicious.{0,20}(?:package|extension|code|script|npm)\b/i,
    label: '窃盗・マルウェア・詐欺事件', blocks_direct: true },
];

function detectRedFlags(text) {
  // Pre-process: neutralise negated auto-trading mentions
  const cleaned = text
    .replace(/自動売買.{0,15}(なく|ない|ありません|なし|していない|禁止)/g, 'SAFE_TRADING')
    .replace(/自動取引.{0,15}(なく|ない|ありません)/g, 'SAFE_TRADING');

  const t = cleaned.toLowerCase();
  const flags = RED_FLAG_RULES.filter(({ re }) => re.test(t));

  // Supplemental: evidence-less revenue claim
  const hasRevClaim = /月\d+万|月収\d+|稼いだ|\d+万円(達成|突破)/.test(text);
  const evidenceCheck = text.replace(/スクリーンショット.{0,20}(なし|無し|ない|ありません)/g, '');
  const hasEvidence = /github|stripe|paypal|動画証拠|売上明細/.test(evidenceCheck.toLowerCase());
  if (hasRevClaim && !hasEvidence && !flags.find(f => f.key === 'revenue_claim_risk')) {
    flags.push({ key: 'revenue_claim_risk', label: '証拠なしの収益主張', blocks_direct: false });
  }

  return flags;
}

// ── Risk level ────────────────────────────────────────────────
function evalRisk(redFlags) {
  const hasBlocking  = redFlags.some(f => f.blocks_direct);
  const warningCount = redFlags.filter(f => !f.blocks_direct).length;
  if (hasBlocking)         return { level: '高', score: 5 };
  if (warningCount >= 3)   return { level: '中', score: 15 };
  if (warningCount >= 1)   return { level: '低', score: 20 };
  return { level: '低', score: 25 };
}

// ── カテゴリ判定用コアテキスト抽出 ────────────────────────────
// 転用先説明（transfer_hint / AI Income Lab投入理由 / 転用できそうな本質）は
// カテゴリ判定から除外する。元ネタの本質（タイトル・URL・概要・情報源）を使う。
function extractCoreText(item) {
  const EXCLUDE_STARTS = [
    '転用できそうな本質', 'transfer_hint', 'ai income lab投入理由',
    '怪しい点', '注意点', '転用先', '転用方向',
  ];

  const bodyLines = item.body.split('\n');
  const coreLines = [];

  for (const line of bodyLines) {
    const lower = line.trim().toLowerCase();
    // 転用関連フィールドに達したらそれ以降を除外
    if (EXCLUDE_STARTS.some(ex => lower.startsWith(ex) || lower.startsWith(ex + ':') || lower.startsWith(ex + '：'))) break;
    coreLines.push(line);
  }

  // automation: / monetization: 行は明示的なカテゴリヒントとして末尾に追加
  for (const line of bodyLines) {
    const lower = line.trim().toLowerCase();
    if (lower.startsWith('automation:') || lower.startsWith('monetization:')) {
      coreLines.push(line);
    }
  }

  return (item.title + ' ' + item.url + ' ' + coreLines.join(' ')).toLowerCase();
}

// ── Category detection ────────────────────────────────────────
function detectCategory(text, categories) {
  const t = text.toLowerCase();
  let best = null, bestN = 0;
  for (const cat of categories) {
    const n = cat.keywords.filter(kw => t.includes(kw.toLowerCase())).length;
    if (n > bestN) { bestN = n; best = cat; }
  }
  return best || { id: 0, name: '未分類', transfer_hints: [], claude_code_angle: '分析ツール化・教材化を検討', risk_note: '' };
}

// ── Claude Code fit ───────────────────────────────────────────
function evalClaudeCodeFit(text, category) {
  const t = text.toLowerCase();
  let s = 5;
  if (/claude code|claude api|anthropic api/i.test(t)) s += 10;
  else if (/\bclaude\b/i.test(t))                      s += 5;  // generic Claude usage
  if (/python/i.test(t))                               s += 5;
  if (/node\.js|javascript|typescript/i.test(t))       s += 3;
  if (/api|webhook|自動化|高速化|バッチ/i.test(t))     s += 4;
  if (/suno|dall-?e|flux\b|midjourney|stable.?diffusion|elevenlabs/i.test(t)) s += 4;
  if (category && category.claude_code_angle)          s += 3;
  return Math.min(25, s);
}

// ── Market validity ───────────────────────────────────────────
function evalMarket(category, text) {
  if (!category || category.name === '未分類') return 8;
  const t = text.toLowerCase();
  let s = 15;
  if (/需要|困って|欲しい|自動化したい|面倒|高速化したい/.test(t)) s += 5;
  if (/競合だらけ|過当競争|既に飽和/.test(t)) s -= 3;
  return Math.min(25, s);
}

// ── Adoption score ────────────────────────────────────────────
function calcAdoptionScore(evScore, riskScore, claudeScore, marketScore, category) {
  let total = evScore + riskScore + claudeScore + marketScore;
  if (category && category.name !== '未分類') total += 8; // known-category bonus
  return Math.min(100, Math.max(0, total));
}

// ── Decision & adoption type ──────────────────────────────────
function determineDecision(score) {
  if (score >= 60) return '採用';
  if (score >= 35) return '保留';
  return '不採用';
}

function determineAdoptionType(decision, redFlags, score) {
  const hasBlocking = redFlags.some(f => f.blocks_direct);
  if (decision === '不採用') return '不採用';
  // Blocking flags force 構造採用 at most
  if (hasBlocking) {
    return score >= 35 ? '構造採用' : '参考';
  }
  if (decision === '採用') return '直接採用';
  return '参考';
}

// ── Core mechanism ────────────────────────────────────────────
function extractCoreMechanism(text, category) {
  const t = text.toLowerCase();
  const parts = [];
  if (/claude code|claude api/i.test(t)) parts.push('Claude Code活用');
  else if (/\bclaude\b/i.test(t))        parts.push('Claude活用');
  else if (/chatgpt|gpt-4|openai/i.test(t)) parts.push('ChatGPT活用');
  else if (/ai|llm/i.test(t))            parts.push('AI/LLM活用');
  if (/suno|ai音楽|ai music/i.test(t))   parts.push('AI音楽生成');
  if (/personas?\.md|brain\.md/i.test(t)) parts.push('AI人格システム');
  if (/engagement payout|creator economy|滞在時間.*収益/i.test(t)) parts.push('プラットフォーム収益');
  if (/context\.md|skill\.md|業務os/i.test(t)) parts.push('業務OS設計');
  if (/複数.*platform|multi-platform|複数平台|複数販路/i.test(t)) parts.push('マルチプラットフォーム展開');
  if (/sns|twitter|x\.com|instagram/i.test(t)) parts.push('SNS活用');
  if (/アフィリエイト|affiliate/i.test(t)) parts.push('アフィリエイト');
  if (/サブスク|月額/i.test(t))            parts.push('サブスク');
  if (parts.length === 0) return (category.name !== '未分類') ? category.name : '仕組み不明';
  return parts.slice(0, 3).join(' × ');
}

// ── Monetisation detection ────────────────────────────────────
function detectMonetization(text) {
  const t = text.toLowerCase();
  if (/アフィリエイト|affiliate/i.test(t)) return 'アフィリエイト';
  if (/サブスク|月額|subscription/i.test(t)) return 'サブスクリプション';
  if (/受託|クライアント|案件/i.test(t)) return 'クライアントワーク';
  if (/教材|講座|有料コンテンツ/i.test(t)) return 'コンテンツ販売';
  if (/stock.?music|sync.?license|streaming/i.test(t)) return 'ストリーミング/ライセンス';
  if (/saas|ツール販売|アプリ販売/i.test(t)) return 'ツール販売';
  if (/engagement payout|creator.?fund|配分/i.test(t)) return 'プラットフォーム収益配分';
  if (/広告|adsense/i.test(t)) return '広告収益';
  return '不明';
}

// ── Reason / why-score ────────────────────────────────────────
function buildWhyScore(score, evidence, risk, redFlags, adoptionType, category) {
  const parts = [];
  const evLabel = evidence.strength === '高' ? '証拠が強い（' + evidence.signals.join('・') + '）'
    : evidence.strength === '中' ? '証拠が中程度（' + (evidence.signals.join('・') || '一部あり') + '）'
    : '証拠が弱い（主張・詳細のみ）';
  parts.push(evLabel);
  if (risk.level === '低') parts.push('リスク低');
  else if (risk.level === '中') parts.push('中リスク（' + redFlags.filter(f => !f.blocks_direct).slice(0, 2).map(f => f.label).join('、') + '）');
  else parts.push('高リスク（' + redFlags.filter(f => f.blocks_direct).slice(0, 2).map(f => f.label).join('、') + '）');
  if (category.name !== '未分類') parts.push('カテゴリ「' + category.name + '」一致でボーナス');
  if (adoptionType === '構造採用') parts.push('直接実行は危険だが構造転用価値あり');
  parts.push('スコア' + score + '点 → ' + determineDecision(score));
  return parts.join('。');
}

// ── Next action ───────────────────────────────────────────────
function nextAction(adoptionType) {
  switch (adoptionType) {
    case '直接採用': return 'Claude Codeで2時間以内のMVPを作って反応を確認する';
    case '構造採用': return '本質パターンを抽出し、安全な転用先に変換してから小実験を設計する';
    case '参考':    return 'research_log.mdに保存。類似事例が増えたら再評価する';
    case '不採用':  return 'スキップ。新規性・転用価値が低いため時間を使わない';
    default:        return '要判断';
  }
}

// ── Duplicate URL detection ───────────────────────────────────
function loadExistingUrls() {
  if (!fs.existsSync(LOG_FILE)) return new Set();
  const matches = [...fs.readFileSync(LOG_FILE, 'utf8').matchAll(/https?:\/\/[^\s|）\)\]]+/g)];
  return new Set(matches.map(m => m[0].trim()));
}

// ── X summary ─────────────────────────────────────────────────
function xSummary(title, decision, mechanism, adoptionType) {
  const icon = decision === '採用' ? '✅' : decision === '保留' ? '⏸️' : '❌';
  const s = `${icon}【${adoptionType}】${title}｜本質:${mechanism}`;
  return s.length > 140 ? s.slice(0, 139) + '…' : s;
}

// ── Full item evaluation ──────────────────────────────────────
function evaluateItem(item, categories, existingUrls) {
  const fullText  = item.title + ' ' + item.body;
  // カテゴリ判定は「元ネタの本質」だけで行う（転用先ヒントは除外）
  const coreText  = extractCoreText(item);
  const category  = detectCategory(coreText, categories);
  const evidence  = evalEvidence(fullText);
  const redFlags  = detectRedFlags(fullText);
  const risk      = evalRisk(redFlags);
  const claudeScore = evalClaudeCodeFit(fullText, category);
  const marketScore = evalMarket(category, fullText);
  const adoptionScore = calcAdoptionScore(evidence.score, risk.score, claudeScore, marketScore, category);
  const decision   = determineDecision(adoptionScore);
  const adoptionType = determineAdoptionType(decision, redFlags, adoptionScore);
  const hintText   = extractTransferHint(item.body);
  const mechanism  = extractCoreMechanism(fullText, category);
  const ideas      = generateTransferIdeas(hintText, category);
  const why        = buildWhyScore(adoptionScore, evidence, risk, redFlags, adoptionType, category);
  const transferSummary = (ideas[0] || '').replace(/^【[^】]*】\s*/, '').slice(0, 70);
  return {
    title:                   item.title,
    source_url:              item.url || '未記載',
    category:                category.name,
    decision,
    adoption_type:           adoptionType,
    adoption_score:          adoptionScore,
    reason_for_decision:     why,
    core_mechanism:          mechanism,
    monetization_model:      detectMonetization(fullText),
    evidence_strength:       evidence.strength,
    evidence_signals:        evidence.signals,
    risk_level:              risk.level,
    red_flags:               redFlags,
    transfer_ideas:          ideas,
    transfer_summary:        transferSummary,
    claude_code_build_idea:  category.claude_code_angle || 'Claude Codeで自動化スクリプト作成',
    notes:                   category.risk_note || '',
    short_summary_for_x:     xSummary(item.title, decision, mechanism, adoptionType),
    recommended_next_action: nextAction(adoptionType),
    is_duplicate:            !!(item.url && existingUrls.has(item.url)),
  };
}

// ── analysis.md ───────────────────────────────────────────────
function buildAnalysis(results, date) {
  const total    = results.length;
  const adopted  = results.filter(r => r.decision === '採用').length;
  const pending  = results.filter(r => r.decision === '保留').length;
  const rejected = results.filter(r => r.decision === '不採用').length;
  const dups     = results.filter(r => r.is_duplicate).length;
  const dupNote  = dups > 0 ? ` | ⚠️ 重複URL: ${dups}件` : '';
  const sorted   = [...results].sort((a, b) => b.adoption_score - a.adoption_score);

  const badges   = { '採用': '✅ 採用', '保留': '⏸️ 保留', '不採用': '❌ 不採用' };
  const typeBdg  = { '直接採用': '🟢 直接採用', '構造採用': '🟡 構造採用', '参考': '🔵 参考', '不採用': '⚫ 不採用' };

  const header = `> ⚠️ この評価はルールベースの一次判定です。収益額や実績主張を事実認定するものではありません。最終判断は人間が行います。

# 評価レポート — ${date}

> 生成: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })} | 評価: ${total}件 | ✅採用: ${adopted} / ⏸️保留: ${pending} / ❌不採用: ${rejected}${dupNote}

---

`;

  const body = sorted.map((r, i) => {
    const dupWarn = r.is_duplicate ? '\n> ⚠️ **重複URL**: research_log.mdに既存。再評価か確認が必要です。\n' : '';
    const flagLines = r.red_flags.length
      ? r.red_flags.map(f => `- ${f.blocks_direct ? '🔴' : '🟡'} **[${f.key}]** ${f.label}`).join('\n')
      : '- 特になし';

    return `## [${i + 1}/${total}] ${r.title} — ${badges[r.decision]}（${r.adoption_score}点）

**adoption_type**: ${typeBdg[r.adoption_type] || r.adoption_type}
${dupWarn}
| 項目 | 内容 |
|-----|------|
| decision | **${r.decision}** |
| adoption_type | **${r.adoption_type}** |
| adoption_score | **${r.adoption_score} / 100** |
| priority_rank | ${i + 1} / ${total} |
| category | \`${r.category}\` |
| evidence_strength | ${r.evidence_strength}${r.evidence_signals.length ? '（' + r.evidence_signals.join('、') + '）' : ''} |
| risk_level | ${r.risk_level} |
| monetization_model | ${r.monetization_model} |
| source_url | ${r.source_url} |

### 判定理由 / why_this_score
${r.reason_for_decision}

### 本質的な仕組み（core_mechanism）
${r.core_mechanism}

### 検出された赤フラグ（detected_red_flags）
${flagLines}

### 転用案（transfer_ideas）
${r.transfer_ideas.map((t, j) => `${j + 1}. ${t}`).join('\n')}

### transfer_summary
${r.transfer_summary}

### Claude Codeで作れるもの
${r.claude_code_build_idea}

### Xサマリー（140字以内）
\`${r.short_summary_for_x}\`

### 推奨アクション（next_action）
${r.recommended_next_action}

${r.notes ? `### 注意事項\n${r.notes}` : ''}

---
`;
  }).join('\n');

  return header + body + `*Generated by AI Income Lab v2.1 — evaluate_idea.js*\n`;
}

// ── results/cases.csv 書き出し（v1互換フォーマット・毎回上書き）────
function writeCasesCSV(results) {
  const CASES_CSV  = path.join(ROOT, 'results', 'cases.csv');
  const V1_HEADERS = [
    'id', 'source', 'url', 'author', 'date', 'claim',
    'revenue_amount', 'revenue_type', 'period',
    'automation_target', 'tools_used', 'monetization_method',
    'evidence_strength', 'reproducibility', 'risk_level',
    'category', 'score', 'next_action',
  ];

  const EV_MAP    = { '高': '強（複数証拠）', '中': '中（一部証拠）', '低': '弱（主張のみ）' };
  const REPRO_MAP = { '直接採用': '高', '構造採用': '中', '参考': '低', '不採用': '低' };
  const NA_MAP    = {
    'Claude Codeで2時間以内のMVPを作って反応を確認する':             '優先実験',
    '本質パターンを抽出し、安全な転用先に変換してから小実験を設計する': '構造研究',
    'research_log.mdに保存。類似事例が増えたら再評価する':             '様子見',
    'スキップ。新規性・転用価値が低いため時間を使わない':               'スキップ',
  };

  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });

  function escCsv(v) {
    const s = String(v ?? '');
    return (s.includes(',') || s.includes('"') || s.includes('\n'))
      ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function authorFromUrl(url) {
    const m = (url || '').match(/x\.com\/([^/?#]+)/i);
    return m ? '@' + m[1] : '';
  }

  function toolsFromText(title) {
    const known = ['Claude Code', 'Python', 'Node.js', 'Suno', 'ElevenLabs',
                   'Flux', 'Midjourney', 'n8n', 'Make', 'Zapier', 'GitHub'];
    const found = known.filter(t => new RegExp(t, 'i').test(title));
    return found.slice(0, 4).join(', ') || 'Claude';
  }

  const rows = [
    V1_HEADERS.join(','),
    ...results.map((r, i) => {
      const vals = {
        id:                  i + 1,
        source:              'input.txt',
        url:                 r.source_url || '',
        author:              authorFromUrl(r.source_url),
        date:                today,
        claim:               r.title || '',
        revenue_amount:      '',
        revenue_type:        r.monetization_model || '',
        period:              '不明',
        automation_target:   r.core_mechanism || '',
        tools_used:          toolsFromText(r.title || ''),
        monetization_method: r.monetization_model || '',
        evidence_strength:   EV_MAP[r.evidence_strength] || r.evidence_strength || '',
        reproducibility:     REPRO_MAP[r.adoption_type] || '中',
        risk_level:          r.risk_level || '',
        category:            r.category || '',
        score:               r.adoption_score ?? 0,
        next_action:         NA_MAP[r.recommended_next_action] || (r.recommended_next_action || '').slice(0, 30),
      };
      return V1_HEADERS.map(h => escCsv(vals[h])).join(',');
    }),
  ];

  fs.mkdirSync(path.dirname(CASES_CSV), { recursive: true });
  fs.writeFileSync(CASES_CSV, rows.join('\n'), 'utf8');
  console.log(`\n📊 results/cases.csv を上書き（${results.length}件・v1互換フォーマット）`);
}

// ── research_log.md append ─────────────────────────────────────
function appendToLog(results, date) {
  const total    = results.length;
  const adopted  = results.filter(r => r.decision === '採用').length;
  const pending  = results.filter(r => r.decision === '保留').length;
  const rejected = results.filter(r => r.decision === '不採用').length;
  const rows = [...results]
    .sort((a, b) => b.adoption_score - a.adoption_score)
    .map(r => {
      const t   = r.title.length > 28 ? r.title.slice(0, 27) + '…' : r.title;
      const url = r.source_url && r.source_url !== '未記載' ? `[link](${r.source_url})` : '—';
      const dup = r.is_duplicate ? ' ⚠️' : '';
      return `| ${t} | ${r.decision} | ${r.adoption_type} | ${r.adoption_score} | ${r.category.slice(0, 22)} | ${url}${dup} |`;
    }).join('\n');
  const entry = `\n## ${date} セッション（${total}件 / ✅採用:${adopted} ⏸️保留:${pending} ❌不採用:${rejected}）\n\n| タイトル | 判定 | 採用タイプ | スコア | カテゴリ | URL |\n|---------|------|---------|-------|---------|-----|\n${rows}\n`;
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
  if (!fs.existsSync(LOG_FILE)) fs.writeFileSync(LOG_FILE, '# リサーチログ\n\n> AI Income Lab v2 — evaluate_idea.js による評価履歴\n\n', 'utf8');
  fs.appendFileSync(LOG_FILE, entry, 'utf8');
}

// ── Console summary (8 fields per item) ───────────────────────
function printSummary(results) {
  const icons = { '採用': '✅', '保留': '⏸️', '不採用': '❌' };
  results.forEach(r => {
    const icon    = icons[r.decision] || '?';
    const dup     = r.is_duplicate ? ' ⚠️ 重複URL' : '';
    const flagStr = r.red_flags.length ? r.red_flags.map(f => f.label).join(' / ') : 'なし';
    console.log(`\n  ${icon} ${r.decision} [${r.adoption_type}] ${r.adoption_score}点 — ${r.title.slice(0, 42)}${dup}`);
    console.log(`     📂 category:   ${r.category}`);
    console.log(`     🔍 evidence:   ${r.evidence_strength}（${r.evidence_signals.join('、') || 'なし'}）`);
    console.log(`     🚩 flags:      ${flagStr}`);
    console.log(`     💡 transfer:   ${r.transfer_summary}`);
    console.log(`     📊 why:        ${r.reason_for_decision.slice(0, 80)}`);
    console.log(`     ▶  next:       ${r.recommended_next_action}`);
  });
}

// ── Entry point ───────────────────────────────────────────────
function main() {
  console.log('=== AI Income Lab v2.1: Idea Evaluator ===\n');
  if (!fs.existsSync(INPUT_FILE)) {
    console.error('❌ input.txt が見つかりません'); process.exit(1);
  }
  const raw = fs.readFileSync(INPUT_FILE, 'utf8').trim();
  if (raw.length < 20) { console.warn('⚠️  input.txt が空です'); return; }

  const categories   = loadCategories();
  const existingUrls = loadExistingUrls();
  const items        = parseInput(raw);
  if (!items.length) { console.warn('⚠️  アイテムが見つかりません。--- で区切ってください'); return; }

  console.log(`📥 ${items.length}件のアイテムを評価中...`);
  const results = items.map(item => evaluateItem(item, categories, existingUrls));
  printSummary(results);

  const date = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
  fs.writeFileSync(ANALYSIS_FILE, buildAnalysis(results, date), 'utf8');
  appendToLog(results, date);
  writeCasesCSV(results); // v2.2: results/cases.csv を上書きして daily パイプラインに接続

  const adopted  = results.filter(r => r.decision === '採用').length;
  const pending  = results.filter(r => r.decision === '保留').length;
  const rejected = results.filter(r => r.decision === '不採用').length;
  const dups     = results.filter(r => r.is_duplicate).length;
  console.log(`\n📊 評価完了: ${items.length}件 | ✅ 採用: ${adopted} | ⏸️ 保留: ${pending} | ❌ 不採用: ${rejected}${dups ? ' | ⚠️ 重複: ' + dups + '件' : ''}`);
  console.log(`📄 analysis.md: ${ANALYSIS_FILE}`);
  console.log(`📝 research_log.md: ${LOG_FILE}`);
}

main();
