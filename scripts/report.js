#!/usr/bin/env node
'use strict';

const fs   = require('fs');
const path = require('path');

const CASES_CSV  = path.join(__dirname, '../results/cases.csv');
const REPORT_DIR = path.join(__dirname, '../reports/daily');

// ── CSV パーサー ──────────────────────────────────────────

function parseCsvLine(line) {
  const cells = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else { inQ = !inQ; }
    } else if (ch === ',' && !inQ) {
      cells.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

function parseCsv(text) {
  const lines   = text.trim().split('\n');
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1)
    .filter(l => l.trim())
    .map(l => {
      const vals = parseCsvLine(l);
      const obj  = {};
      headers.forEach((h, i) => { obj[h] = vals[i] ?? ''; });
      return obj;
    });
}

// ── ヘルパー ──────────────────────────────────────────────

function num(s) { return Number(s) || 0; }

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '…' : s;
}

function riskBadge(r) {
  if (r === '高') return '🔴 高';
  if (r === '中') return '🟡 中';
  return '🟢 低';
}

function scoreBadge(s) {
  const n = num(s);
  if (n >= 75) return `**${n}点** 🏆`;
  if (n >= 55) return `**${n}点** 🔍`;
  if (n >= 35) return `**${n}点** 👀`;
  return `**${n}点**`;
}

// ── パターン集計 ──────────────────────────────────────────

function countBy(cases, key) {
  const map = {};
  cases.forEach(c => { const v = c[key] || 'その他'; map[v] = (map[v] || 0) + 1; });
  return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

// ── リスク警告文生成 ──────────────────────────────────────

function riskWarnings(c) {
  const ws = [];
  if (c.risk_level === '高') ws.push('高リスク案件');
  if ((c.evidence_strength || '').match(/なし|不明/)) ws.push('証拠不明');
  if ((c.evidence_strength || '').match(/弱/)) ws.push('証拠が弱い');
  if (c.category === '情報商材') ws.push('情報商材の可能性');
  if ((c.claim || '').match(/絶対|確実に|誰でも/)) ws.push('誇大表現あり');
  return ws.length > 0 ? ws.join(' / ') : '要確認';
}

// ── 深掘り理由 ────────────────────────────────────────────

function deepReason(c) {
  const rs = [];
  if (c.reproducibility === '高')                  rs.push('再現性◎');
  if ((c.evidence_strength || '').startsWith('強')) rs.push('証拠が強い');
  if ((c.tools_used || '').toLowerCase().includes('claude')) rs.push('Claude活用可能');
  if (c.risk_level === '低')                        rs.push('低リスク');
  return rs.join('・') || 'スコアが高い';
}

// ── 小実験案 ─────────────────────────────────────────────

function genExperiments(cases) {
  const sorted = [...cases].sort((a, b) => num(b.score) - num(a.score));
  const top = sorted.slice(0, 5);
  const done = new Set();
  const exps = [];

  for (const c of top) {
    const cat = c.category;
    if (done.has(cat)) continue;
    done.add(cat);

    if (cat === 'SEO/コンテンツ') {
      exps.push('1. 既存ブログ記事1本をClaude Codeで自動SEOチェック → 改善案3つ抽出（所要: 30分）');
    } else if (cat === 'SNS自動化') {
      exps.push('2. 今週のSNS投稿5本をClaude Codeで下書き自動生成 → 手動確認後に投稿（所要: 1時間）');
    } else if (cat === 'Polymarket') {
      exps.push('3. Polymarket上位20市場の価格をAPIで取得してCSVに保存するスクリプトを作る（所要: 2時間）');
    } else if (cat === 'AI画像販売') {
      exps.push('4. DALL-Eで10枚生成 → Boothに無料出品して反応を見る（所要: 2時間）');
    } else if (cat === 'SaaS/ツール') {
      exps.push('5. 小さなCLIツールを1つ作ってGitHubに公開 → スター数を観察（所要: 半日）');
    }
  }

  if (exps.length === 0) {
    exps.push('1. `data/raw/` に今日集めた事例を追加して `npm run daily` を再実行（所要: 15分）');
    exps.push('2. スコア上位事例のGitHubリポジトリを実際にcloneして試す（所要: 1時間）');
  }
  return exps.join('\n');
}

// ── 明日集める情報 ────────────────────────────────────────

function genTomorrow(cases) {
  const cats = new Set(cases.map(c => c.category));
  const todos = [];

  if (!cats.has('SaaS/ツール'))   todos.push('- SaaS/ツール系事例（ProductHunt, Indie Hackers等）');
  if (!cats.has('Polymarket'))   todos.push('- Polymarket観察Bot（GitHub: "polymarket bot"で検索）');
  if (!cats.has('SNS自動化'))    todos.push('- SNS自動化事例（note/Zennで「Claude Code 自動投稿」検索）');
  if (!cats.has('SEO/コンテンツ')) todos.push('- SEO自動化事例（Zennで「Claude Code SEO」検索）');

  const weakEv = cases.filter(c => (c.evidence_strength || '').match(/弱|なし/));
  if (weakEv.length > 0) {
    todos.push(`- 証拠不十分な${weakEv.length}件の元投稿・GitHubを追加確認`);
  }

  todos.push('- note/Zennで「Claude Code 副業」「AI 自動化 収益」の記事を5件保存');
  todos.push('- 高スコア事例の使用ツールをローカルでインストールして動作確認');
  return todos.join('\n');
}

// ── スコア分布表 ──────────────────────────────────────────

function scoreTable(cases) {
  const s75 = cases.filter(c => num(c.score) >= 75).length;
  const s55 = cases.filter(c => num(c.score) >= 55 && num(c.score) < 75).length;
  const s35 = cases.filter(c => num(c.score) >= 35 && num(c.score) < 55).length;
  const s0  = cases.filter(c => num(c.score) < 35).length;
  return `| スコア帯 | 件数 | アクション |
|---------|------|-----------|
| 75〜100点 | ${s75}件 | 優先実験 |
| 55〜74点 | ${s55}件 | 詳細調査 |
| 35〜54点 | ${s35}件 | 様子見 |
| 0〜34点  | ${s0}件  | スキップ |`;
}

// ── レポート生成 ──────────────────────────────────────────

function buildReport(cases, date) {
  const sorted    = [...cases].sort((a, b) => num(b.score) - num(a.score));
  const top5      = sorted.slice(0, 5);
  const suspicious = cases
    .filter(c => c.risk_level === '高' || (c.evidence_strength || '').match(/弱|なし/))
    .sort((a, b) => num(a.score) - num(b.score))
    .slice(0, 5);
  const deepDive  = sorted
    .filter(c => ['優先実験', '詳細調査'].includes(c.next_action))
    .slice(0, 3);
  const patterns  = countBy(cases, 'category').slice(0, 6);

  return `# AI収益化事例 日次レポート — ${date}

> 生成: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })} | 分析件数: ${cases.length}件

---

## 今日の有望事例 TOP5

${top5.map((c, i) => `### ${i + 1}. ${truncate(c.claim, 70)}

| 項目 | 内容 |
|-----|------|
| スコア | ${scoreBadge(c.score)} |
| カテゴリ | ${c.category} |
| 収益主張 | ${c.revenue_amount || '不明'} |
| 使用ツール | ${truncate(c.tools_used, 50)} |
| 証拠強度 | ${c.evidence_strength} |
| 再現性 | ${c.reproducibility} |
| リスク | ${riskBadge(c.risk_level)} |
| 次のアクション | **${c.next_action}** |
| ソース | \`${c.source}\` |
`).join('\n')}

---

## 怪しい事例 TOP5（要注意）

${suspicious.map((c, i) => `### ${i + 1}. ${truncate(c.claim, 70)}

| 項目 | 内容 |
|-----|------|
| スコア | ${scoreBadge(c.score)} |
| リスク | ${riskBadge(c.risk_level)} |
| カテゴリ | ${c.category} |
| 証拠強度 | ${c.evidence_strength} |
| 収益主張 | ${c.revenue_amount || '不明'} |
| 警告 | ⚠️ ${riskWarnings(c)} |
`).join('\n')}

---

## 深掘り候補 TOP3

${deepDive.map((c, i) => `### ${i + 1}. ${truncate(c.claim, 70)}

- **スコア**: ${scoreBadge(c.score)}
- **自動化対象**: ${c.automation_target}
- **収益化手法**: ${c.monetization_method}
- **使用ツール**: ${truncate(c.tools_used, 60)}
- **深掘り理由**: ${deepReason(c)}
`).join('\n')}

---

## 多かった収益化パターン

${patterns.map(([cat, n]) => `- **${cat}**: ${n}件 (${Math.round(n / cases.length * 100)}%)`).join('\n')}

---

## 自分が試すべき小実験案

${genExperiments(cases)}

---

## 明日集めるべき情報

${genTomorrow(cases)}

---

## スコア分布

${scoreTable(cases)}

---

*Generated by AI Income Lab v1.0 — data/raw/ に素材を追加して \`npm run daily\` を実行するたびに更新されます*
`;
}

// ── エントリーポイント ────────────────────────────────────

function main() {
  console.log('=== AI Income Lab: Report Generator ===\n');

  if (!fs.existsSync(CASES_CSV)) {
    console.error('❌ cases.csv が見つかりません。先に npm run analyze を実行してください。');
    process.exit(1);
  }

  const cases = parseCsv(fs.readFileSync(CASES_CSV, 'utf8'));
  if (cases.length === 0) {
    console.warn('⚠️  分析済み事例が0件です。data/raw または data/samples にデータを追加してください。');
    return;
  }

  const today  = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
  const report = buildReport(cases, today);

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const out = path.join(REPORT_DIR, `${today}.md`);
  fs.writeFileSync(out, report, 'utf8');

  console.log(`✅ レポート生成完了: ${out}`);
  console.log(`📊 分析件数: ${cases.length}件`);

  const top = [...cases].sort((a, b) => Number(b.score) - Number(a.score))[0];
  if (top) {
    console.log(`\n🏆 最高スコア: ${top.claim?.slice(0, 50)} (${top.score}点 / ${top.next_action})`);
  }

  const high = cases.filter(c => c.risk_level === '高');
  if (high.length > 0) {
    console.log(`⚠️  高リスク事例: ${high.length}件（スキップ推奨）`);
  }
}

main();
