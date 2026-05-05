#!/usr/bin/env node
'use strict';

const fs   = require('fs');
const path = require('path');
const { scoreCase } = require('./score');

const DATA_DIRS = [
  path.join(__dirname, '../data/raw'),
  path.join(__dirname, '../data/samples'),
];
const OUTPUT_CSV = path.join(__dirname, '../results/cases.csv');

const CSV_HEADERS = [
  'id', 'source', 'url', 'author', 'date', 'claim',
  'revenue_amount', 'revenue_type', 'period',
  'automation_target', 'tools_used', 'monetization_method',
  'evidence_strength', 'reproducibility', 'risk_level',
  'category', 'score', 'next_action',
];

// ── ファイル読み込み ──────────────────────────────────────

const SKIP_FILES = new Set(['template.md', 'readme.md', '.gitkeep']);

function readDir(dir) {
  if (!fs.existsSync(dir)) return [];
  const ok = new Set(['.md', '.txt', '.json']);
  return fs.readdirSync(dir)
    .filter(f => ok.has(path.extname(f).toLowerCase()) && !SKIP_FILES.has(f.toLowerCase()))
    .map(f => ({ name: f, content: fs.readFileSync(path.join(dir, f), 'utf8') }));
}

// ── ブロック分割 ──────────────────────────────────────────

function splitBlocks(content) {
  // ## Case N: の行を区切り点にして分割
  const parts = content.split(/(?=^##\s+Case\s+\d+)/im);
  return parts.filter(p => /^##\s+Case\s+\d+/im.test(p));
}

// ── フィールド抽出ヘルパー ────────────────────────────────

function getField(block, name) {
  // ` *` で同じ行のみマッチ（\s* は改行を跨ぐため使用しない）
  const re = new RegExp(`\\*\\*${name}\\*\\*:? *([^\\n]*)`);
  const m  = block.match(re);
  return m ? m[1].trim() : '';
}

function getClaim(block) {
  // **投稿内容**: の後の「同じ行」だけを取得（\s* は改行を跨がせない）
  const m = block.match(/\*\*投稿内容\*\*:? *([^\n]{5,})/);
  if (m) return m[1].trim().substring(0, 250);
  // フォールバック: ## Case N: タイトルを使う
  const t = block.match(/^##\s+Case\s+\d+[:\s]+(.+)/im);
  return t ? t[1].trim() : '';
}

// ── ツール検出 ────────────────────────────────────────────

const KNOWN_TOOLS = [
  'Claude Code', 'ChatGPT', 'GPT-4', 'GPT-4o', 'Gemini',
  'n8n', 'Make', 'Zapier', 'Google Apps Script',
  'Python', 'Node.js', 'JavaScript', 'TypeScript',
  'Midjourney', 'DALL-E', 'Stable Diffusion',
  'Airtable', 'Notion', 'Supabase', 'Stripe',
  'Polymarket', 'Twitter API', 'Booth API',
];

function detectTools(block, rawTools) {
  const found = KNOWN_TOOLS.filter(t => block.includes(t));
  return found.length > 0 ? found.join(', ') : (rawTools || '不明');
}

// ── カテゴリ推定 ──────────────────────────────────────────

function detectCategory(block) {
  if (block.match(/Polymarket|予測市場/i)) return 'Polymarket';
  if (block.match(/AI画像|Midjourney|DALL-E|Stable Diffusion|画像販売|Booth/i)) return 'AI画像販売';
  if (block.match(/情報商材|教材|高額講座|198,000|198000/)) return '情報商材';
  if (block.match(/SNS|Instagram|投稿自動|Twitter API/i)) return 'SNS自動化';
  if (block.match(/SEO|ブログ|アフィリエイト|メタタグ|キーワード/)) return 'SEO/コンテンツ';
  if (block.match(/SaaS|月額|サブスク|APIサービス/i)) return 'SaaS/ツール';
  return 'その他';
}

// ── 収益タイプ推定 ────────────────────────────────────────

function detectRevenueType(block) {
  if (block.includes('アフィリエイト')) return 'アフィリエイト';
  if (block.match(/受託|クライアント|フリーランス/)) return 'サービス報酬';
  if (block.match(/月額|サブスク|SaaS/i)) return 'SaaS/月額';
  if (block.match(/情報商材|教材|講座/)) return '情報販売';
  if (block.match(/Booth|マーケットプレイス|AI画像/i)) return 'デジタル販売';
  if (block.match(/Polymarket|予測市場/i)) return '予測市場';
  if (block.match(/広告|AdSense/i)) return '広告収益';
  return '不明';
}

// ── 期間推定 ──────────────────────────────────────────────

function detectPeriod(block) {
  if (block.match(/月[\d０-９]|月収|月\d/)) return '月次';
  if (block.match(/日[\d０-９]|日収/)) return '日次';
  if (block.match(/年[\d０-９]|年収/)) return '年次';
  return '不明';
}

// ── 証拠強度評価 ──────────────────────────────────────────

function evalEvidence(block, evidenceField) {
  const t = (block + evidenceField).toLowerCase();
  let pts = 0;
  if (t.includes('github') || t.includes('リポジトリ'))         pts += 3;
  if (t.includes('スクリーンショット') || t.includes('screenshot')) pts += 2;
  if (t.includes('stripe') || t.includes('売上画面') || t.includes('振込')) pts += 3;
  if (t.includes('動画') || t.includes('デモ'))                 pts += 2;
  if (t.includes('証拠なし') || t.includes('主張のみ'))         pts -= 3;
  if (t.includes('加工') || t.includes('不明'))                  pts -= 1;

  if (pts >= 5) return '強（複数証拠）';
  if (pts >= 3) return '中（一部証拠）';
  if (pts >= 1) return '弱（主張のみ）';
  return 'なし（証拠不明）';
}

// ── 再現性評価 ────────────────────────────────────────────

function evalReproducibility(block) {
  let pts = 0;
  if (block.match(/GitHub|コード公開|オープンソース/i)) pts += 3;
  if (block.match(/手順|チュートリアル|README|ステップ/))        pts += 2;
  if (block.match(/MIT|Apache|ライセンス/i))                     pts += 1;
  if (block.match(/特殊|人脈|コネ|独占|限定/))                  pts -= 2;

  if (pts >= 4) return '高';
  if (pts >= 1) return '中';
  return '低';
}

// ── リスク評価 ────────────────────────────────────────────

function evalRisk(block, category) {
  let risk = 0;
  if (category === '情報商材') risk += 5;
  if (block.match(/絶対|確実に|誰でも|必ず稼/)) risk += 3;
  if (block.match(/\d{6,}円|100万|1000万/))    risk += 2;
  if (block.match(/規約違反|凍結|BAN|垢BAN/i)) risk += 3;
  if (block.match(/Polymarket|予測市場|賭け/i)) risk += 1;
  if (block.match(/GitHub|MIT|オープンソース/i)) risk -= 1;
  if (block.match(/自動売買|自動投資|FX自動/))  risk += 3;

  if (risk >= 5) return '高';
  if (risk >= 2) return '中';
  return '低';
}

// ── 補助マップ ────────────────────────────────────────────

const AUTO_TARGET_MAP = {
  'SEO/コンテンツ': 'SEO記事生成・最適化',
  'SNS自動化':      'SNS投稿下書き・スケジューリング',
  'Polymarket':     '予測市場の観察・データ収集',
  'AI画像販売':     'AI画像生成・マーケットプレイス販売',
  '情報商材':       '情報コンテンツ販売',
  'SaaS/ツール':    'SaaSプロダクト開発・販売',
  'その他':         '汎用自動化',
};

const MONETIZE_MAP = {
  'アフィリエイト': 'アフィリエイトリンク経由',
  'サービス報酬':   'クライアントワーク（受託）',
  'SaaS/月額':      'サブスクリプション',
  '情報販売':       'デジタルコンテンツ直販',
  'デジタル販売':   'マーケットプレイス販売',
  '予測市場':       '予測市場取引（観察中）',
  '広告収益':       'アドネットワーク',
};

// ── ブロック解析メイン ────────────────────────────────────

function parseBlock(block, sourceName) {
  const rawTools    = getField(block, '使用ツール');
  const evidenceRaw = getField(block, '証拠');
  const riskRaw     = getField(block, 'リスク').match(/^(低|中|高)/)?.[1] || '';
  const catRaw      = getField(block, 'カテゴリ');

  const category         = catRaw || detectCategory(block);
  const risk_level       = riskRaw || evalRisk(block, category);
  const tools_used       = detectTools(block, rawTools);
  const revenue_type     = detectRevenueType(block);
  const period           = detectPeriod(block);
  const evidence_strength = evalEvidence(block, evidenceRaw);
  const reproducibility  = evalReproducibility(block);
  const automation_target    = AUTO_TARGET_MAP[category] || '汎用自動化';
  const monetization_method  = MONETIZE_MAP[revenue_type] || '不明';

  const obj = {
    source:              sourceName,
    url:                 getField(block, 'URL'),
    author:              getField(block, '投稿者'),
    date:                getField(block, '日付'),
    claim:               getClaim(block),
    revenue_amount:      getField(block, '収益主張'),
    revenue_type,
    period,
    automation_target,
    tools_used,
    monetization_method,
    evidence_strength,
    reproducibility,
    risk_level,
    category,
  };

  const { score, next_action } = scoreCase(obj);
  return { ...obj, score, next_action };
}

// ── 空枠フィルタ ─────────────────────────────────────────
// url・author・収益主張・投稿内容がすべて空の場合はテンプレート枠と判定してスキップ

function isEmptyCase(c) {
  const isBlank = s => !s || s.trim() === '';
  // 全角 ［ または ASCII [ で始まるタイトルはプレースホルダー
  const isPlaceholder = s => isBlank(s) || /^[\[［]/.test(s.trim());
  const filled = [c.url, c.author, c.revenue_amount].filter(v => !isBlank(v));
  return filled.length === 0 && isPlaceholder(c.claim);
}

// ── CSV ───────────────────────────────────────────────────

function escapeCell(v) {
  const s = String(v ?? '');
  return (s.includes(',') || s.includes('"') || s.includes('\n'))
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

// ── エントリーポイント ────────────────────────────────────

function main() {
  console.log('=== AI Income Lab: Analyzer ===\n');

  const cases = [];
  let id = 1;

  for (const dir of DATA_DIRS) {
    const files = readDir(dir);
    console.log(`📂 ${path.basename(dir)}: ${files.length}件のファイル`);

    for (const { name, content } of files) {
      // JSON配列・オブジェクト
      if (name.endsWith('.json')) {
        try {
          const arr = JSON.parse(content);
          const items = Array.isArray(arr) ? arr : [arr];
          items.forEach(item => {
            const { score, next_action } = scoreCase(item);
            cases.push({ id: id++, ...item, score, next_action });
          });
          console.log(`  📄 ${name}: ${items.length}件 (JSON)`);
        } catch { console.warn(`  ⚠️  JSON解析エラー: ${name}`); }
        continue;
      }

      // Markdown / テキスト
      const blocks = splitBlocks(content);
      let parsed = 0;
      let skipped = 0;
      blocks.forEach(block => {
        try {
          const c = parseBlock(block, name);
          if (isEmptyCase(c)) { skipped++; return; }
          cases.push({ id: id++, ...c });
          parsed++;
        } catch (e) {
          console.warn(`  ⚠️  ブロック解析エラー: ${name} — ${e.message}`);
        }
      });
      const skipNote = skipped > 0 ? ` (空枠 ${skipped}件をスキップ)` : '';
      console.log(`  📄 ${name}: ${parsed}件を分析${skipNote}`);
    }
  }

  // CSV書き出し
  fs.mkdirSync(path.dirname(OUTPUT_CSV), { recursive: true });
  const rows = [
    CSV_HEADERS.join(','),
    ...cases.map(c => CSV_HEADERS.map(h => escapeCell(c[h])).join(',')),
  ];
  fs.writeFileSync(OUTPUT_CSV, rows.join('\n'), 'utf8');

  console.log(`\n✅ ${cases.length}件を分析 → ${OUTPUT_CSV}`);
}

main();
