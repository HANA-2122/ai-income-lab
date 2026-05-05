'use strict';

/**
 * スコアリングモジュール（100点満点）
 *
 * 需要         20点 — 市場規模・再現事例の多さ
 * 収益化しやすさ 20点 — 収益額・収益化速度
 * 再現性        20点 — コード公開・手順の明確さ
 * 強みとの相性  20点 — Claude Code / JS / Python活用度
 * リスクの低さ  20点 — 法規制・規約・詐欺リスク
 */

function scoreCase(c) {
  const category         = String(c.category         || '');
  const evidence         = String(c.evidence_strength || '');
  const reproducibility  = String(c.reproducibility   || '');
  const risk             = String(c.risk_level         || '');
  const tools            = String(c.tools_used         || '').toLowerCase();
  const revenueStr       = String(c.revenue_amount     || '');

  // ── 需要 (0-20) ──────────────────────────────
  const demandMap = {
    'SEO/コンテンツ': 18,
    'SNS自動化':      16,
    'SaaS/ツール':    17,
    'AI画像販売':     12,
    'Polymarket':     11,
    '情報商材':        3,
    'その他':         10,
  };
  const demand = demandMap[category] ?? 10;

  // ── 収益化しやすさ (0-20) ────────────────────
  const amount = parseJpAmount(revenueStr);
  let monetize = 8;
  if (amount >= 500000) monetize = 20;
  else if (amount >= 100000) monetize = 17;
  else if (amount >= 50000)  monetize = 14;
  else if (amount >= 10000)  monetize = 10;
  else if (amount > 0)       monetize = 6;

  // ── 再現性 (0-20) ────────────────────────────
  let repro = 5;
  if (reproducibility === '高') repro = 20;
  else if (reproducibility === '中') repro = 12;

  // ── 強みとの相性 (0-20) ──────────────────────
  let match = 4;
  if (tools.includes('claude')) match += 8;
  if (tools.includes('node') || tools.includes('javascript')) match += 4;
  if (tools.includes('python')) match += 4;
  if (tools.includes('n8n') || tools.includes('make') || tools.includes('zapier')) match += 2;
  match = Math.min(match, 20);

  // ── リスクの低さ (0-20) ──────────────────────
  let lowRisk = 5;
  if (risk === '低') lowRisk = 20;
  else if (risk === '中') lowRisk = 11;
  // risk === '高' → 3点

  // ── 証拠ボーナス (+0〜5) ──────────────────────
  let bonus = 0;
  if (evidence.startsWith('強')) bonus = 5;
  else if (evidence.startsWith('中')) bonus = 2;

  const total = Math.min(100, demand + monetize + repro + match + lowRisk + bonus);

  // ── 次のアクション ────────────────────────────
  let next_action;
  if (risk === '高') {
    next_action = 'スキップ（高リスク）';
  } else if (total >= 75) {
    next_action = '優先実験';
  } else if (total >= 55) {
    next_action = '詳細調査';
  } else if (total >= 35) {
    next_action = '様子見';
  } else {
    next_action = 'スキップ';
  }

  return {
    score: total,
    breakdown: { demand, monetize, repro, match, lowRisk, bonus },
    next_action,
  };
}

function parseJpAmount(str) {
  if (!str) return 0;
  const s = str.replace(/[,，、\s]/g, '');
  const man  = s.match(/(\d+(?:\.\d+)?)万/);
  if (man) return Math.floor(parseFloat(man[1]) * 10000);
  const sen  = s.match(/(\d+(?:\.\d+)?)千/);
  if (sen) return Math.floor(parseFloat(sen[1]) * 1000);
  const num  = s.match(/(\d+)/);
  if (num) return parseInt(num[1], 10);
  return 0;
}

module.exports = { scoreCase, parseJpAmount };
