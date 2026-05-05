#!/usr/bin/env node
// build_input_draft.js — normalized_sources.json の上位件から input.txt 用の下書きを生成
// 出力先: data/collected/input_draft.txt
'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT       = path.join(__dirname, '..');
const NORM_IN    = path.join(ROOT, 'data', 'collected', 'normalized_sources.json');
const DRAFT_OUT  = path.join(ROOT, 'data', 'collected', 'input_draft.txt');

const TOP_N = 10; // 上位何件を下書きに含めるか

// ── 1件のブロックを生成（evaluate_idea.js が解析できる形式）────
function buildBlock(item) {
  const lines = [
    `[${item.title}]`,
    item.url,
    '',
  ];

  // 基本メタ情報（body として evaluate_idea.js のキーワード検出に使われる）
  lines.push(`source: ${item.source}`);
  if (item.summary_hint && item.summary_hint !== item.title) {
    lines.push(`summary: ${item.summary_hint.slice(0, 200)}`);
  }
  lines.push(`why_interesting: ${item.why_interesting}`);
  lines.push(`monetization_hint: ${item.monetization_hint}`);
  lines.push(`transfer_hint: ${item.transfer_hint}`);
  lines.push(`risk_hint: ${item.risk_hint}`);

  // ソース固有の数値（evaluate のキーワード検出・証拠評価に活用される）
  if (item.stars != null)        lines.push(`stars: ${item.stars}`);
  if (item.forks != null)        lines.push(`forks: ${item.forks}`);
  if (item.language)             lines.push(`language: ${item.language}`);
  if (item.points != null)       lines.push(`points: ${item.points}`);
  if (item.num_comments != null) lines.push(`comments: ${item.num_comments}`);
  if (item.keyword)              lines.push(`keyword: ${item.keyword}`);
  lines.push(`score: ${item.score}`);

  return lines.join('\n');
}

// ── メイン ────────────────────────────────────────────────────
function main() {
  console.log('=== Build Input Draft ===\n');

  if (!fs.existsSync(NORM_IN)) {
    console.error('❌ normalized_sources.json が見つかりません。先に npm run collect を実行してください。');
    process.exit(1);
  }

  const items = JSON.parse(fs.readFileSync(NORM_IN, 'utf8'));
  if (items.length === 0) {
    console.warn('⚠️  normalized_sources.json が空です。');
    return;
  }

  const topItems = items.slice(0, TOP_N);
  const date     = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });

  const header = [
    `# AI Income Lab - Collector Generated Draft`,
    `# Generated: ${date}`,
    `# Source: ${[...new Set(topItems.map(x => x.source))].join(' / ')}`,
    `# Top ${topItems.length} / ${items.length} items by score`,
    `#`,
    `# ── 使い方 ──────────────────────────────────────────────`,
    `# 1. このファイルを確認・編集する`,
    `# 2. 不要な Case を削除、必要なら notes を追記`,
    `# 3. input.txt にコピーペーストまたは: copy data\\collected\\input_draft.txt input.txt`,
    `# 4. npm run evaluate を実行`,
    `# ─────────────────────────────────────────────────────────`,
  ].join('\n');

  const blocks = topItems.map(buildBlock);

  const content = header + '\n\n---\n' + blocks.join('\n---\n') + '\n';

  fs.mkdirSync(path.dirname(DRAFT_OUT), { recursive: true });
  fs.writeFileSync(DRAFT_OUT, content, 'utf8');

  console.log(`✅ input_draft.txt を生成: ${DRAFT_OUT}`);
  console.log(`\n上位${topItems.length}件:`);
  topItems.forEach((item, i) =>
    console.log(`  ${i + 1}. [${item.score}点] ${item.title.slice(0, 55)} (${item.source})`));

  console.log(`\n次のステップ:`);
  console.log(`  1. data/collected/input_draft.txt を確認・編集`);
  console.log(`  2. 内容を input.txt にコピー`);
  console.log(`  3. npm run evaluate を実行`);
}

main();
