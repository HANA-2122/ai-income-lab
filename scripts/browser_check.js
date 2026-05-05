#!/usr/bin/env node
// browser_check.js — AI Income Lab オプション機能
// Playwright Chromium で JS 描画後のページ本文を取得し、収益化・リスクシグナルを検出する
// 通常の collect / daily パイプラインとは独立したオプション実行ステップ
//
// 使い方:
//   npm run browser-check -- https://opencode.ai/      # 単体URL
//   npm run browser-check -- --all                     # input.txt から最大10件
//
// 注意:
//   - ログイン不要の公開ページのみ対象
//   - X自動投稿・大量スクレイピング・ログイン操作はしない
//   - 各URLに待機時間を入れてサーバーに礼儀を守る
'use strict';

const path = require('path');
const fs   = require('fs');

const ROOT       = path.join(__dirname, '..');
const INPUT_FILE = path.join(ROOT, 'input.txt');
const DRAFT_FILE = path.join(ROOT, 'data', 'collected', 'input_draft.txt');
const RESULT_F   = path.join(ROOT, 'data', 'collected', 'browser_check_results.json');
const REPORT_F   = path.join(ROOT, 'reports', 'daily', 'browser-check.md');
const MAX_URLS   = 10;

// ── 収益化シグナル（英語 + 日本語）────────────────────────────
const MONETIZATION_SIGNALS = [
  // 英語
  { key: 'MCP',             re: /\bmcp\b|\bmodel.?context.?protocol/i },
  { key: 'Claude Code',     re: /claude.?code/i },
  { key: 'Claude',          re: /\bclaude\b/i },
  { key: 'automation',      re: /\bautomat(?:ion|e|ed|ing)\b/i },
  { key: 'workflow',        re: /\bworkflow/i },
  { key: 'template',        re: /\btemplate|\bstarter.?kit|\bboilerplate/i },
  { key: 'SaaS',            re: /\bsaas\b/i },
  { key: 'subscription',    re: /\bsubscri|\bmonthly.?plan|\bannual.?plan|\bpricing/i },
  { key: 'marketplace',     re: /\bmarketplace|\bgumroad|\bbooth\b|\betsy|\bshopify/i },
  { key: 'open-source',     re: /\bopen.?source|\boss\b|\bmit.?licen|\bapache.?licen/i },
  { key: 'AI coding',       re: /ai.?cod(?:ing|er|e)|\bcoding.?agent|\bcoding.?assistant/i },
  { key: 'terminal',        re: /\bterminal\b|\bcli\b|\bcommand.?line/i },
  // 日本語
  { key: 'オープンソース',   re: /オープンソース/ },
  { key: '自動化',           re: /自動化|ワークフロー自動/ },
  { key: 'ワークフロー',     re: /ワークフロー/ },
  { key: 'テンプレート',     re: /テンプレート/ },
  { key: 'サブスク/月額',    re: /サブスク|月額|月払い|年払い/ },
  { key: '課金',             re: /課金|有料プラン|料金/ },
  { key: 'AIコーディング',   re: /AIコーディング|コーディングエージェント|AIエージェント/ },
  { key: 'ターミナル',       re: /ターミナル|コマンドライン/ },
  { key: 'ブラウザ操作',     re: /ブラウザ操作|ブラウザ自動化/ },
  { key: '業務効率化',       re: /業務効率化|業務自動化|業務改善/ },
  { key: 'マーケットプレイス', re: /マーケットプレイス|販売サイト/ },
];

// ── リスクシグナル（英語 + 日本語）────────────────────────────
const RISK_SIGNALS = [
  { key: 'theft/heist',       re: /\btheft\b|\bheist\b/i },
  { key: 'malware/malicious', re: /\bmalware\b|\bmalicious\b/i },
  { key: 'phishing',          re: /\bphishing\b/i },
  { key: 'leak/exploit',      re: /\bleak(?:ed)?\b|\bexploit\b/i },
  { key: 'crack',             re: /\bcrack(?:ed)?\b|\bpirat(?:ed|acy)\b/i },
  { key: 'rug pull',          re: /\brug.?pull\b/i },
  { key: '著作権侵害',         re: /著作権侵害|無断コピー|無断転載/ },
  { key: 'フィッシング',       re: /フィッシング/ },
  { key: 'マルウェア',         re: /マルウェア|悪意のあるコード/ },
  { key: '不正利用',           re: /不正利用|不正アクセス/ },
];

// ── URL 解析 ────────────────────────────────────────────────────
function analyze(url, data) {
  const combined = [data.title, ...data.h1s, ...data.h2s, data.bodyText.slice(0, 10000)].join(' ');
  const monHits  = MONETIZATION_SIGNALS.filter(s => s.re.test(combined)).map(s => s.key);
  const riskHits = RISK_SIGNALS.filter(s => s.re.test(combined)).map(s => s.key);
  const monScore = monHits.length * 10;

  // リスクは hold に寄せる（2件以上でも reject ではなく hold + 要文脈確認）
  let recommended_action;
  if (riskHits.length >= 1) {
    recommended_action = 'hold';
  } else if (monHits.length >= 3) {
    recommended_action = 'adopt';
  } else if (monHits.length >= 1) {
    recommended_action = 'hold';
  } else {
    recommended_action = 'hold';
  }

  let notes = '';
  if (riskHits.length >= 2) {
    notes = `⚠️ リスクシグナル${riskHits.length}件（要文脈確認）: ${riskHits.join(', ')}`;
  } else if (riskHits.length === 1) {
    notes = `⚠️ リスクシグナル: ${riskHits[0]}（文脈を確認してください）`;
  } else if (monHits.length >= 3) {
    notes = `✅ 収益化シグナル強（${monHits.length}件）`;
  } else {
    notes = `ℹ️ 収益化シグナル ${monHits.length}件`;
  }

  return {
    url,
    page_title:           data.title,
    h1:                   data.h1s.slice(0, 3),
    h2:                   data.h2s.slice(0, 6),
    body_text_length:     data.bodyText.length,
    monetization_signals: monHits,
    risk_signals:         riskHits,
    recommended_action,
    mon_score:            monScore,
    fetch_method:         'playwright-chromium-headless',
    notes,
    checked_at:           new Date().toISOString(),
  };
}

// ── input.txt / input_draft.txt から URL 抽出 ──────────────────
function loadUrlsFromInput(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const txt = fs.readFileSync(filePath, 'utf8');
  const urls = [];
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/https?:\/\/[^\s）\)\]"']+/);
    if (m) {
      const u = m[0].replace(/[）\)\]"',;]+$/, '');
      if (!urls.includes(u)) urls.push(u);
    }
  }
  return urls;
}

// ── Markdown レポート生成 ────────────────────────────────────────
function generateReport(results, mode) {
  const today = new Date().toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' });
  const sorted = [...results].sort((a, b) => b.mon_score - a.mon_score);
  const adopted = results.filter(r => r.recommended_action === 'adopt');
  const held    = results.filter(r => r.recommended_action === 'hold');

  const lines = [];
  lines.push('# AI Income Lab — Browser Check レポート');
  lines.push(`> 生成日: ${today} | モード: ${mode} | 対象: ${results.length}件 | 採用候補: ${adopted.length} | 保留: ${held.length}`);
  lines.push('');
  lines.push('## 全件サマリー');
  lines.push('');
  lines.push('| 推奨 | URL | 収益化シグナル | body | リスク |');
  lines.push('|------|-----|--------------|------|--------|');
  sorted.forEach(r => {
    const icon = r.recommended_action === 'adopt' ? '✅' : '⏸️';
    const shortUrl = r.url.replace('https://github.com/','gh:').replace('https://','').slice(0,45);
    const monStr = r.monetization_signals.slice(0,4).join(', ') + (r.monetization_signals.length > 4 ? `…+${r.monetization_signals.length-4}` : '');
    lines.push(`| ${icon} ${r.recommended_action} | ${shortUrl} | ${monStr||'—'} | ${r.body_text_length}文字 | ${r.risk_signals.join(', ')||'—'} |`);
  });
  lines.push('');

  lines.push('## 採用候補 詳細');
  lines.push('');
  sorted.filter(r => r.recommended_action === 'adopt').forEach((r, i) => {
    lines.push(`### ${i+1}. ${r.page_title || r.url}`);
    lines.push(`- URL: ${r.url}`);
    lines.push(`- 収益化シグナル: ${r.monetization_signals.join(' / ')}`);
    lines.push(`- ${r.notes}`);
    lines.push('');
  });

  if (held.length > 0) {
    lines.push('## 保留候補');
    lines.push('');
    held.forEach(r => {
      lines.push(`- ⏸️ **${r.url}** — ${r.notes}`);
    });
    lines.push('');
  }

  lines.push('---');
  lines.push('*Generated by AI Income Lab v2.4.2 — npm run browser-check*');
  return lines.join('\n');
}

// ── メイン ──────────────────────────────────────────────────────
async function main() {
  // playwright の検索順: グローバル → experiments/playwright-mcp-mvp/
  let chromium;
  const PW_PATHS = [
    'playwright',
    path.join(ROOT, 'experiments', 'playwright-mcp-mvp', 'node_modules', 'playwright'),
  ];
  for (const p of PW_PATHS) {
    try { ({ chromium } = require(p)); break; } catch { /* 次を試す */ }
  }
  if (!chromium) {
    console.error('❌ playwright が見つかりません。');
    console.error('   cd experiments/playwright-mcp-mvp && npm install  を実行してください。');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const isAll = args.includes('--all');
  const singleUrl = args.find(a => a.startsWith('http'));

  let urls = [];
  let mode = '';

  if (singleUrl) {
    urls = [singleUrl];
    mode = `単体URL: ${singleUrl}`;
  } else if (isAll) {
    // input.txt → なければ input_draft.txt の順で読む
    const src = fs.existsSync(INPUT_FILE) ? INPUT_FILE : DRAFT_FILE;
    urls = loadUrlsFromInput(src).slice(0, MAX_URLS);
    mode = `--all (${path.basename(src)} から ${urls.length}件)`;
    if (urls.length === 0) {
      console.error(`❌ URL が見つかりません: ${src}`);
      process.exit(1);
    }
  } else {
    console.log('使い方:');
    console.log('  npm run browser-check -- https://example.com/   # 単体URL');
    console.log('  npm run browser-check -- --all                   # input.txt から最大10件');
    process.exit(0);
  }

  console.log(`\n=== AI Income Lab Browser Check ===`);
  console.log(`モード: ${mode}`);
  console.log(`対象: ${urls.length}件\n`);

  const browser = await chromium.launch({ headless: true });
  const results = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    process.stdout.write(`  [${i+1}/${urls.length}] ${url.slice(0,62)} ... `);

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      locale: 'ja-JP',
    });
    const page = await context.newPage();

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(3000);

      const data = await page.evaluate(() => {
        const title   = document.title || '';
        const h1s     = [...document.querySelectorAll('h1')].map(h => h.innerText.trim()).filter(Boolean).slice(0, 5);
        const h2s     = [...document.querySelectorAll('h2')].map(h => h.innerText.trim()).filter(Boolean).slice(0, 8);
        const bodyText = (document.body?.innerText || '').replace(/\s{2,}/g, ' ').trim().slice(0, 15000);
        return { title, h1s, h2s, bodyText };
      });

      const r = analyze(url, data);
      console.log(`✅ mon:${r.monetization_signals.length} risk:${r.risk_signals.length} body:${r.body_text_length}文字 → ${r.recommended_action}`);
      results.push(r);
    } catch (e) {
      console.log(`❌ ${e.message.slice(0, 60)}`);
      results.push({
        url, page_title: '', h1: [], h2: [], body_text_length: 0,
        monetization_signals: [], risk_signals: [],
        recommended_action: 'hold', mon_score: 0,
        fetch_method: 'playwright-chromium-headless',
        notes: `取得失敗: ${e.message.slice(0, 100)}`,
        checked_at: new Date().toISOString(),
      });
    } finally {
      await context.close();
    }

    if (i < urls.length - 1) await new Promise(r => setTimeout(r, 800));
  }

  await browser.close();

  // results.json 保存
  fs.writeFileSync(RESULT_F, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\n📄 ${path.relative(ROOT, RESULT_F)}`);

  // browser-check.md 生成
  const report = generateReport(results, mode);
  fs.writeFileSync(REPORT_F, report, 'utf8');
  console.log(`📝 ${path.relative(ROOT, REPORT_F)}`);

  // コンソールサマリー
  const sorted = [...results].sort((a, b) => b.mon_score - a.mon_score);
  console.log('\n=== 収益化スコア TOP3 ===');
  sorted.slice(0, 3).forEach((r, i) => {
    console.log(`  ${i+1}. [${r.mon_score}pt] ${(r.page_title || r.url).slice(0, 55)}`);
    console.log(`     ${r.monetization_signals.slice(0, 6).join(', ') || '—'}`);
  });
  console.log('\n✅ Browser Check 完了');
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
