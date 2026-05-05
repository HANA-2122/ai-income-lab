#!/usr/bin/env node
// normalize_sources.js — raw_sources.json + urls.txt を正規化してスコアリング
'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT        = path.join(__dirname, '..');
const RAW_IN      = path.join(ROOT, 'data', 'collected', 'raw_sources.json');
const NORM_OUT    = path.join(ROOT, 'data', 'collected', 'normalized_sources.json');
const URLS_FILE   = path.join(ROOT, 'data', 'sources', 'urls.txt');
const KEYWORDS_F  = path.join(ROOT, 'data', 'sources', 'keywords.json');

// ── 危険ワード定義（ペナルティ・ラベル）────────────────────────
const DANGER_RULES = [
  // リーク・流出系（最強ペナルティ）
  { re: /source.?leak|leaked?.?source|code.?leak/i,              penalty: 45, label: 'ソースコードリーク情報' },
  { re: /\bleaked?\b/i,                                           penalty: 40, label: 'リーク情報' },
  // プロンプト流出・内部情報
  { re: /system.?prompts?(?!.?engineer)/i,                        penalty: 35, label: 'システムプロンプト流出系' },
  { re: /\bconfidential\b|\binternal.?prompt|\binternal.?tool/i, penalty: 25, label: '機密/内部情報' },
  // セキュリティ悪用系
  { re: /\bjailbreak(?!.?analys)/i,                               penalty: 30, label: 'ジェイルブレイク' },
  { re: /prompt.?inject/i,                                        penalty: 30, label: 'プロンプトインジェクション攻撃' },
  { re: /\bexploit(?!.?(?:analys|detect|prevent|remov))/i,       penalty: 30, label: 'エクスプロイト' },
  { re: /bypass.{0,20}(?:filter|guard|safety|censor|restrict)/i, penalty: 30, label: 'セーフガードバイパス' },
  // 著作権・違法系
  { re: /\bcracked?\b|\bpirated?\b|\bstolen\b/i,                 penalty: 35, label: '著作権侵害コンテンツ' },
  { re: /\bdump\b(?!.{0,30}(?:export|backup.?tool|utility))/i,  penalty: 20, label: 'データダンプ系' },
  // 既存ペナルティ統合
  { re: /scam|guaranteed.?income|get.?rich.?quick|make.?money.?fast|\$\d+k.?day/i, penalty: 30, label: '誇大収益主張' },
  { re: /fork.only|archive|deprecated|unmaintained/i,            penalty: 10, label: '非推奨/アーカイブ済み' },
  // 窃盗・不正アクセス・マルウェア系（v2.4.x false positive 対策）
  { re: /\btheft\b|\bheist\b/i,                                    penalty: 40, label: '窃盗・犯罪事件' },
  { re: /\bmalicious\b|\bmalware\b/i,                              penalty: 35, label: 'マルウェア・悪意あるコード' },
  { re: /\bcompromised\b/i,                                        penalty: 30, label: 'セキュリティ侵害' },
  { re: /\bphishing\b|\brug.?pull\b/i,                             penalty: 35, label: 'フィッシング・ラグプル' },
  // 金額 + 危険文脈の組み合わせ（収益主張への誤分類を防ぐ）
  { re: /\$[\d,]+[kKmM]?.{0,40}(?:theft|heist|hack(?!aton)|rug.?pull)/i, penalty: 50, label: '金額+犯罪・詐欺文脈' },
  { re: /(?:theft|heist|hack(?!aton)|rug.?pull).{0,40}\$[\d,]+[kKmM]?/i, penalty: 50, label: '金額+犯罪・詐欺文脈' },
];

// 危険スコアを計算し、ラベルリストを返す
function detectDanger(text) {
  let totalPenalty = 0;
  const labels = [];
  for (const { re, penalty, label } of DANGER_RULES) {
    if (re.test(text)) {
      totalPenalty += penalty;
      labels.push(label);
    }
  }
  return { penalty: totalPenalty, labels };
}

// ── 安全・良質ワード追加ボーナス ─────────────────────────────────
const SAFE_BONUSES = [
  { re: /starter.?kit|boilerplate/i,  bonus: 6 },
  { re: /self.?hosted/i,              bonus: 5 },
  { re: /dashboard/i,                 bonus: 4 },
  { re: /marketplace/i,               bonus: 4 },
  { re: /creator.?tool/i,             bonus: 5 },
  { re: /ai.?workflow|workflow.?ai/i, bonus: 5 },
];

// ── スコアリング ───────────────────────────────────────────────
function calcScore(item) {
  let s = 40;

  // GitHub: stars / forks
  if (item.source === 'github') {
    const st = item.stars || 0;
    if (st >= 5000) s += 25;
    else if (st >= 1000) s += 20;
    else if (st >= 500)  s += 15;
    else if (st >= 100)  s += 10;
    else if (st >= 50)   s += 5;
    if ((item.forks || 0) >= 200) s += 5;
    else if ((item.forks || 0) >= 50) s += 2;
  }

  // HN: points / comments
  if (item.source === 'hackernews') {
    const pt = item.points || 0;
    if (pt >= 500)       s += 25;
    else if (pt >= 200)  s += 20;
    else if (pt >= 100)  s += 15;
    else if (pt >= 50)   s += 10;
    else if (pt >= 20)   s += 5;
    const nc = item.num_comments || 0;
    if (nc >= 100)       s += 5;
    else if (nc >= 50)   s += 3;
    else if (nc >= 20)   s += 1;
  }

  // Manual URL: 中立スコア
  if (item.source === 'manual') s = 55;

  // URL のパス部分も含めて危険ワードチェック（リポジトリ名のリーク語を検出）
  const text = [item.title, item.description, item.url].filter(Boolean).join(' ').toLowerCase();

  // ── 危険ワード ペナルティ（先に適用して上限を抑える）──────────
  const { penalty } = detectDanger(text);
  s -= penalty;

  // ペナルティが大きい場合はここで早期打ち切り（ボーナスで復活させない）
  if (s <= 20) return Math.max(0, s);

  // ── AI / 自動化 ボーナス ─────────────────────────────────────
  if (/ai.?agent|llm.agent|claude|cursor.?ai|mcp.?server|n8n|automat|workflow/i.test(text)) s += 8;
  if (/micro.?saas|saas|chrome.?ext|plugin|extension/i.test(text)) s += 5;
  if (/template|library|snippet|tool|kit/i.test(text)) s += 5;
  if (/open.?source|mit.?licens|apache/i.test(text)) s += 3;

  // ── 収益化キーワード ボーナス（危険文脈がない場合のみ加点）────────
  // 窃盗・詐欺・マルウェア文脈での金額表現を収益事例と誤認識しないためのガード
  const hasDangerCtx = /\b(?:theft|heist|stolen|malicious|malware|compromised|phishing|rug.?pull)\b/i.test(text);
  if (!hasDangerCtx && /monetiz|paid|subscription|revenue|income|pricing|gumroad|shopify|etsy|patreon/i.test(text)) s += 8;

  // ── 安全・良質ワード 追加ボーナス ────────────────────────────
  for (const { re, bonus } of SAFE_BONUSES) {
    if (re.test(text)) s += bonus;
  }

  return Math.min(100, Math.max(0, s));
}

// ── ヒント生成 ─────────────────────────────────────────────────
function buildHints(item) {
  const text = `${item.title || ''} ${item.description || ''}`.toLowerCase();

  const why = [];
  if ((item.stars || 0) >= 100 || (item.points || 0) >= 50) why.push('注目度が高い');
  if (/claude|cursor|gpt|openai|anthropic/i.test(text))     why.push('主要AIツール活用');
  if (/automat|workflow|pipeline|agent/i.test(text))        why.push('自動化要素あり');
  if (/saas|subscription|paid|revenue/i.test(text))         why.push('収益化モデルあり');
  if (/template|library|prompt|plugin/i.test(text))         why.push('再利用可能な成果物');

  const mon = [];
  if (/template|テンプレ/i.test(text))                       mon.push('テンプレート販売');
  if (/saas|subscription/i.test(text))                       mon.push('SaaS/サブスク');
  if (/course|tutorial|教材/i.test(text))                    mon.push('教材/コース');
  if (/agency|consulting/i.test(text))                       mon.push('エージェンシー/コンサル');
  if (/gumroad|etsy|shopify|patreon/i.test(text))           mon.push('マーケットプレイス販売');

  const transfer = [];
  if (/workflow|automat|agent/i.test(text))                  transfer.push('業務自動化テンプレート化');
  if (/template|library|plugin/i.test(text))                 transfer.push('Claude Codeスキルライブラリ化');
  if (/saas|tool|chrome.?ext/i.test(text))                  transfer.push('小型SaaS/ツール販売');
  if (/ai.*generat|generat.*ai|image.?gen|music.?gen/i.test(text)) transfer.push('AIアセットカタログ展開');
  if (/newsletter|content|publish|seo/i.test(text))         transfer.push('SEOミニサイト/マルチ展開');

  // URL も含めた全文で危険ワードを検出
  const fullText = [item.title, item.description, item.url].filter(Boolean).join(' ').toLowerCase();
  const { labels: dangerLabels } = detectDanger(fullText);

  const risk = [...dangerLabels]; // 危険ワードラベルを最優先で追加
  if (/proprietary|closed.?source/i.test(text))               risk.push('ライセンス要確認');
  if (/alpha|beta|experimental|wip/i.test(text))              risk.push('安定性が低い可能性');
  if (/paid|subscription|credit/i.test(text))                 risk.push('有料サービス依存リスク');
  if ((item.source === 'github') && ((item.stars || 0) < 20)) risk.push('実績が少ない');

  return {
    why_interesting:   why.join('・')      || 'AI/自動化関連',
    monetization_hint: mon.join('・')      || '要調査',
    transfer_hint:     transfer.join('・') || '詳細確認後に転用先を特定',
    risk_hint:         risk.join('・')     || '標準リスク水準',
  };
}

// ── メイン ────────────────────────────────────────────────────
function main() {
  console.log('=== Normalize Sources ===\n');

  // raw_sources.json 読み込み
  let rawItems = [];
  if (fs.existsSync(RAW_IN)) {
    rawItems = JSON.parse(fs.readFileSync(RAW_IN, 'utf8'));
    console.log(`📂 raw_sources.json: ${rawItems.length}件`);
  } else {
    console.warn('⚠️  raw_sources.json が見つかりません。npm run collect を先に実行してください。');
  }

  // urls.txt から手動URLを追加（非コメント行）
  if (fs.existsSync(URLS_FILE)) {
    const lines = fs.readFileSync(URLS_FILE, 'utf8').split('\n')
      .map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    const existingUrls = new Set(rawItems.map(x => x.url));
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
    let manualAdded = 0;
    for (const url of lines) {
      if (!/^https?:\/\//i.test(url) || existingUrls.has(url)) continue;
      rawItems.push({ source: 'manual', title: url, url, description: '', keyword: 'manual', raw_score: 50, collected_at: today });
      manualAdded++;
    }
    if (manualAdded > 0) console.log(`📎 urls.txt から ${manualAdded}件の手動URLを追加`);
  }

  if (rawItems.length === 0) {
    console.warn('⚠️  正規化するデータがありません。');
    return;
  }

  // 正規化
  const normalized = rawItems.map((item, idx) => {
    const hints = buildHints(item);
    const score = calcScore(item);
    return {
      id:                `${item.source}_${String(idx + 1).padStart(4, '0')}`,
      source:            item.source,
      title:             item.title || '',
      url:               item.url   || '',
      summary_hint:      item.description || item.title || '',
      ...hints,
      score,
      stars:             item.stars       || null,
      forks:             item.forks       || null,
      points:            item.points      || null,
      num_comments:      item.num_comments || null,
      language:          item.language    || null,
      keyword:           item.keyword     || '',
      collected_at:      item.collected_at || '',
    };
  });

  // スコア降順にソート
  normalized.sort((a, b) => b.score - a.score);

  fs.mkdirSync(path.dirname(NORM_OUT), { recursive: true });
  fs.writeFileSync(NORM_OUT, JSON.stringify(normalized, null, 2), 'utf8');

  console.log(`\n✅ ${normalized.length}件を正規化 → ${NORM_OUT}`);

  console.log('\n📈 TOP10（安全候補が上位に来ているか確認）:');
  normalized.slice(0, 10).forEach((x, i) => {
    const riskNote = x.risk_hint && x.risk_hint !== '標準リスク水準'
      ? ` ⚠️  ${x.risk_hint.split('・')[0]}`
      : '';
    console.log(`  ${i + 1}. [${x.score}点] ${x.title.slice(0, 52)}${riskNote}`);
  });

  // 危険ワードで減点された候補を別途表示
  const flagged = normalized.filter(x => x.risk_hint && DANGER_RULES.some(r => x.risk_hint.includes(r.label)));
  if (flagged.length > 0) {
    console.log(`\n🚩 危険ワードで減点された候補（${flagged.length}件）:`);
    flagged.slice(0, 5).forEach(x =>
      console.log(`  [${x.score}点] ${x.title.slice(0, 45)} → ${x.risk_hint.split('・')[0]}`));
  }
}

main();
