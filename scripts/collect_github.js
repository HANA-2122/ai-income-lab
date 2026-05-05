#!/usr/bin/env node
// collect_github.js — GitHub 公開検索で候補リポジトリを収集
// APIキーなしでも動作。GITHUB_TOKEN があれば高速化（30req/min vs 10req/min）
'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const ROOT        = path.join(__dirname, '..');
const KEYWORDS_F  = path.join(ROOT, 'data', 'sources', 'keywords.json');
const RAW_OUT     = path.join(ROOT, 'data', 'collected', 'raw_sources.json');

// ── HTTP helper ──────────────────────────────────────────────
function fetchJson(urlStr, headers = {}) {
  return new Promise((resolve) => {
    const parsed = new URL(urlStr);
    const options = {
      hostname: parsed.hostname,
      port:     443,
      path:     parsed.pathname + parsed.search,
      method:   'GET',
      headers:  { 'User-Agent': 'ai-income-lab-collector/1.0', 'Accept': 'application/vnd.github.v3+json', ...headers },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        if (res.statusCode === 403) {
          const reset = res.headers['x-ratelimit-reset'];
          const wait  = reset ? Math.max((parseInt(reset, 10) * 1000 - Date.now() + 3000), 5000) : 65000;
          console.warn(`  ⚠️  GitHub rate limit. ${Math.ceil(wait / 1000)}s 待機中...`);
          setTimeout(() => resolve(null), wait);
          return;
        }
        if (res.statusCode !== 200) { console.warn(`  ⚠️  HTTP ${res.statusCode}`); resolve(null); return; }
        try { resolve(JSON.parse(body)); } catch { resolve(null); }
      });
    });
    req.on('error', (e) => { console.warn(`  ⚠️  ${e.message}`); resolve(null); });
    req.setTimeout(15000, () => { req.destroy(); console.warn('  ⚠️  timeout'); resolve(null); });
    req.end();
  });
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ── メイン ────────────────────────────────────────────────────
async function main() {
  console.log('=== GitHub Collector ===\n');

  if (!fs.existsSync(KEYWORDS_F)) {
    console.error('❌ data/sources/keywords.json が見つかりません'); process.exit(1);
  }

  const config   = JSON.parse(fs.readFileSync(KEYWORDS_F, 'utf8'));
  const keywords = config.core_keywords.slice(0, 12); // 12件に制限（実行時間を抑える）
  const token    = process.env.GITHUB_TOKEN;
  const delay    = token ? 2500 : 7000; // 認証なし: 10req/min = 6s間隔。余裕を持って7s
  const authHdr  = token ? { Authorization: `token ${token}` } : {};

  if (!token) {
    console.log('ℹ️  GITHUB_TOKEN 未設定。非認証モード（10req/min）。全体で約90秒かかります。');
    console.log('   高速化: set GITHUB_TOKEN=ghp_xxxx または export GITHUB_TOKEN=ghp_xxxx\n');
  } else {
    console.log('✅ GITHUB_TOKEN 設定済み。認証モード（30req/min）\n');
  }

  // 既存データ読み込み
  let existing = [];
  if (fs.existsSync(RAW_OUT)) {
    existing = JSON.parse(fs.readFileSync(RAW_OUT, 'utf8'));
  }
  const seenUrls = new Set(existing.filter(x => x.source === 'github').map(x => x.url));
  const today    = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });

  const collected = [];

  for (let i = 0; i < keywords.length; i++) {
    const kw  = keywords[i];
    const q   = encodeURIComponent(`${kw} in:name,description,topics`);
    const url = `https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=5`;

    process.stdout.write(`  [${i + 1}/${keywords.length}] "${kw}" ... `);
    const data = await fetchJson(url, authHdr);

    if (!data || !Array.isArray(data.items)) {
      console.log('スキップ');
      if (i < keywords.length - 1) await sleep(delay);
      continue;
    }

    let added = 0;
    for (const item of data.items) {
      if (seenUrls.has(item.html_url)) continue;
      seenUrls.add(item.html_url);

      const stars = item.stargazers_count || 0;
      // raw_score: 星の対数スケール（100点上限）
      const raw_score = Math.min(100, Math.floor(Math.log10(stars + 1) * 22));

      collected.push({
        source:       'github',
        title:        item.full_name,
        url:          item.html_url,
        description:  (item.description || '').slice(0, 200),
        stars,
        forks:        item.forks_count || 0,
        language:     item.language || '',
        created_at:   item.created_at,
        updated_at:   item.updated_at,
        keyword:      kw,
        raw_score,
        collected_at: today,
      });
      added++;
    }
    console.log(`${added}件追加`);
    if (i < keywords.length - 1) await sleep(delay);
  }

  // 非GitHubの既存データと統合して保存
  const nonGithub = existing.filter(x => x.source !== 'github');
  const githubOld = existing.filter(x => x.source === 'github');
  const merged    = [...nonGithub, ...githubOld, ...collected];

  fs.mkdirSync(path.dirname(RAW_OUT), { recursive: true });
  fs.writeFileSync(RAW_OUT, JSON.stringify(merged, null, 2), 'utf8');

  console.log(`\n✅ GitHub: ${collected.length}件の新規リポジトリを収集（合計 ${merged.length}件）`);
}

main().catch(console.error);
