#!/usr/bin/env node
// collect_hn.js — Hacker News Algolia API で候補記事を収集
// 認証不要・rate limit なし
'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const ROOT       = path.join(__dirname, '..');
const KEYWORDS_F = path.join(ROOT, 'data', 'sources', 'keywords.json');
const RAW_OUT    = path.join(ROOT, 'data', 'collected', 'raw_sources.json');

// ── HTTP helper ──────────────────────────────────────────────
function fetchJson(urlStr) {
  return new Promise((resolve) => {
    const parsed = new URL(urlStr);
    const options = {
      hostname: parsed.hostname,
      port:     443,
      path:     parsed.pathname + parsed.search,
      method:   'GET',
      headers:  { 'User-Agent': 'ai-income-lab-collector/1.0', 'Accept': 'application/json' },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
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
  console.log('=== Hacker News Collector ===\n');

  if (!fs.existsSync(KEYWORDS_F)) {
    console.error('❌ data/sources/keywords.json が見つかりません'); process.exit(1);
  }

  const config   = JSON.parse(fs.readFileSync(KEYWORDS_F, 'utf8'));
  const keywords = config.core_keywords; // HN は rate limit なし、全件OK
  const today    = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });

  // 既存データ読み込み
  let existing = [];
  if (fs.existsSync(RAW_OUT)) {
    existing = JSON.parse(fs.readFileSync(RAW_OUT, 'utf8'));
  }
  const seenUrls = new Set(existing.map(x => x.url).filter(Boolean));

  const collected = [];

  for (let i = 0; i < keywords.length; i++) {
    const kw  = keywords[i];
    const q   = encodeURIComponent(kw);
    const url = `https://hn.algolia.com/api/v1/search?query=${q}&tags=story&hitsPerPage=5`;

    process.stdout.write(`  [${i + 1}/${keywords.length}] "${kw}" ... `);
    const data = await fetchJson(url);

    if (!data || !Array.isArray(data.hits)) {
      console.log('スキップ');
      await sleep(500);
      continue;
    }

    let added = 0;
    for (const hit of data.hits) {
      // URL: 外部URLがあればそれ、なければHN item URL
      const externalUrl = hit.url || null;
      const hnUrl       = `https://news.ycombinator.com/item?id=${hit.objectID}`;
      const primaryUrl  = externalUrl || hnUrl;

      if (seenUrls.has(primaryUrl)) continue;
      seenUrls.add(primaryUrl);

      const points      = hit.points || 0;
      const numComments = hit.num_comments || 0;
      // raw_score: points と comments の組み合わせ
      const raw_score   = Math.min(100, Math.floor(Math.log10(points + 1) * 20 + Math.log10(numComments + 1) * 5));

      collected.push({
        source:       'hackernews',
        title:        (hit.title || '').slice(0, 200),
        url:          primaryUrl,
        hn_url:       hnUrl,
        description:  '',   // HN にはない（記事本文は未取得）
        author:       hit.author || '',
        points,
        num_comments: numComments,
        created_at:   hit.created_at || '',
        keyword:      kw,
        raw_score,
        collected_at: today,
      });
      added++;
    }
    console.log(`${added}件追加`);
    await sleep(300); // HN は rate limit 緩いが礼儀として少し待つ
  }

  // 既存データと統合して保存
  const hnOld  = existing.filter(x => x.source === 'hackernews');
  const others = existing.filter(x => x.source !== 'hackernews');
  const merged = [...others, ...hnOld, ...collected];

  fs.mkdirSync(path.dirname(RAW_OUT), { recursive: true });
  fs.writeFileSync(RAW_OUT, JSON.stringify(merged, null, 2), 'utf8');

  console.log(`\n✅ HN: ${collected.length}件の新規記事を収集（合計 ${merged.length}件）`);
}

main().catch(console.error);
