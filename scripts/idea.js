#!/usr/bin/env node
'use strict';

const fs   = require('fs');
const path = require('path');

const CASES_CSV  = path.join(__dirname, '../results/cases.csv');
const IDEAS_CSV  = path.join(__dirname, '../results/ideas.csv');
const REPORT_DIR = path.join(__dirname, '../reports/daily');

// ── CSV ───────────────────────────────────────────────────

function parseCsvLine(line) {
  const cells = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else { inQ = !inQ; }
    } else if (ch === ',' && !inQ) { cells.push(cur); cur = ''; }
    else { cur += ch; }
  }
  cells.push(cur);
  return cells;
}

function parseCsv(text) {
  const lines   = text.trim().split('\n');
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).filter(l => l.trim()).map(l => {
    const vals = parseCsvLine(l);
    const obj  = {};
    headers.forEach((h, i) => { obj[h] = vals[i] ?? ''; });
    return obj;
  });
}

function escapeCell(v) {
  const s = String(v ?? '');
  return (s.includes(',') || s.includes('"') || s.includes('\n'))
    ? `"${s.replace(/"/g, '""')}"` : s;
}

// ── シグナルタイプ検出 ─────────────────────────────────────

function detectSignal(c) {
  const cat  = c.category   || '';
  const risk = c.risk_level || '';
  const rev  = c.revenue_amount || '';
  const ev   = c.evidence_strength || '';

  if (cat === '情報商材' || risk === '高') return 'suspicious_claim';

  const noRev = !rev || rev.match(/収益なし|0円|不明/i);
  if (!noRev) return 'revenue_claim';

  const strongEv = ev.includes('強') || (c.tools_used || '').match(/GitHub|github/i);
  if (strongEv) return 'capability_demo';

  const claimLow = (c.claim || '').toLowerCase();
  if (claimLow.match(/困|面倒|分から|できない|難し|自動化|手作業|欲し/)) return 'pain_signal';

  return 'capability_demo';
}

// ── 能力パターン辞書 ──────────────────────────────────────

const PATTERNS = {
  'SEO/コンテンツ': {
    pattern:  'AI文章解析・SEOコンテンツ構造化の自動実行',
    reaction: 'SEO改善は収益に直結するため、時間投資対効果が可視化しやすい',
    who:      'ブログ・アフィリエイト運営者、コンテンツマーケター',
    trap:     '類似SEOツールとの差別化が難しい。Googleアルゴリズム変更リスクあり',
  },
  'SNS自動化': {
    pattern:  'SNS投稿コンテンツの自動生成・トーン調整・スケジューリング',
    reaction: '毎日の投稿ネタ切れ・継続できないという普遍的な悩みに刺さる',
    who:      '個人発信者・中小企業SNS担当・コーチ・コンサルタント',
    trap:     'プラットフォーム規約変更リスク。自動投稿は規約要確認',
  },
  'Polymarket': {
    pattern:  '予測市場データのリアルタイム取得・可視化・トレンド分析',
    reaction: 'データ格差を解消するツールへの需要。参入障壁を下げる価値',
    who:      'Polymarket参加者・予測市場に興味がある投資家・データエンジニア',
    trap:     '自動取引Botは現時点で禁止方針。規制変更リスクあり',
  },
  'AI画像販売': {
    pattern:  'AI画像生成の自動化・プロンプト最適化・マーケットプレイス出品',
    reaction: 'デジタルコンテンツ販売の低コスト化トレンドに乗っている',
    who:      'クリエイター志望者・副業でデジタル商品を売りたい人',
    trap:     'Booth等の規約変更リスク。大量生成による品質低下・価格競争',
  },
  '情報商材': {
    pattern:  '（観察対象）煽り文句・感情訴求・高額ファネルの構造分析',
    reaction: '「副業への渇望」「お金の不安」という感情を利用している構造',
    who:      '（反面教師として）同じ悩みを持つ人への訴え方の参考',
    trap:     '情報商材を作る・販売するのは高リスク。観察専用に留める',
  },
  'SaaS/ツール': {
    pattern:  '特定タスクを自動化するCLI/WebツールのAI支援高速開発',
    reaction: '繰り返し作業への不満は普遍的。「これ自動化できる」という驚き',
    who:      'エンジニア・フリーランサー・業務効率化を求める事業者',
    trap:     '有料化の難しさ（無料で出すと課金されにくい）。競合参入が速い',
  },
  'その他': {
    pattern:  'AI活用による特定作業の効率化・自動実行',
    reaction: '時間節約・作業削減という普遍的な需要',
    who:      '効率化を求める全般',
    trap:     '汎用化しすぎると競合が多い。ニッチ化しすぎると市場が小さい',
  },
  // ── v2.1 新カテゴリ ──────────────────────────────────────
  'PLATFORM_ENGAGEMENT_PORTFOLIO': {
    pattern:  'プラットフォーム内でコンテンツ・体験・ゲームをAIで量産し engagement 収益を積み上げるポートフォリオ型モデル',
    reaction: 'プラットフォームが収益化インフラを提供しているため「作る」ことに集中できる。1本大当たり狙いより複数分散が安定',
    who:      'ゲーム・インタラクティブコンテンツ制作者、副業で収益源を増やしたいクリエイター',
    trap:     'プラットフォーム規約変更・収益配分率変更・審査リスク。AIコードだけでは完成品質に届かない可能性がある',
  },
  'AI_AGENT_OS_OR_SKILL_REPO': {
    pattern:  '専門知識・業務ノウハウをmarkdown化しAIエージェントが毎回読んで実行できる業務OSとして再利用する',
    reaction: '「毎回ゼロから指示」コストがゼロになる。専門家の思考順序をAIに再現させられる',
    who:      'マーケター・コンサル・エンジニアで、専門知識を持ちながら繰り返し作業に疲れている人',
    trap:     'スキルファイルの品質・文脈依存性が高い。顧客データや実測なしでは一般論にとどまる',
  },
  'MULTI_PLATFORM_PRODUCT_REPURPOSING': {
    pattern:  '1つのアイデア・コンテンツ・商品を複数プラットフォームの購買文脈に合わせて変換する',
    reaction: '1回作ったものが複数の収益源になる。在庫ゼロで複数販路を試せる',
    who:      'デジタルコンテンツ販売を始めたい人・副業で複数収入源を作りたい人',
    trap:     '商標・著作権・低品質量産のリスク。$127K等の収益主張は検証困難',
  },
  'AI_ASSET_CATALOG': {
    pattern:  'AI生成物（音楽・画像・動画・テンプレ）を単発作品ではなく検索・販売・ライセンス可能なカタログ資産にする',
    reaction: '「作るコスト」が下がり、カタログ数×単価の積み上げ型収益が可能になった',
    who:      'AI生成物を副収入にしたい人・クリエイティブ素材を販売したい人',
    trap:     'AI生成物の著作権帰属・商用利用条件・競争飽和・品質選別がボトルネック',
  },
  'AI_PERSONA_CHARACTER_SYSTEM': {
    pattern:  'AI人格・キャラクターをmarkdownファイル群で定義し、記憶・声・外見・会話ルールを分離して継続運用する',
    reaction: 'ファンとの「継続的な関係性」を自動化・スケールできる。キャラへの感情移入で課金が継続する',
    who:      'VTuber・SNSキャラ運用・ゲームNPC設計・教育キャラ・ブランドキャラを作りたい人',
    trap:     '成人向け・欺瞞リスク高。架空人物であることの開示義務あり。プラットフォームBANリスク',
  },
};

// ── カテゴリ表示名マップ（英語IDを人間向け日本語名に変換）────────
const CATEGORY_DISPLAY_NAMES = {
  // v2.1 新カテゴリ
  'AI_AGENT_OS_OR_SKILL_REPO':          '業務AIスキルOS',
  'PLATFORM_ENGAGEMENT_PORTFOLIO':       '参加型コンテンツ量産',
  'MULTI_PLATFORM_PRODUCT_REPURPOSING':  'マルチ販路展開',
  'AI_ASSET_CATALOG':                    'AI素材カタログ',
  'AI_PERSONA_CHARACTER_SYSTEM':         'AIキャラ運用システム',
  // v1 既存カテゴリ
  'SEO/コンテンツ':                       'SEOコンテンツ',
  'SNS自動化':                            'SNS自動化',
  'Polymarket':                           'Polymarket観察',
  'Polymarket / 市場非効率検出系':         '市場データ分析',
  'AI画像販売':                           'AI画像販売',
  '情報商材':                             '情報商材（観察用）',
  'SaaS/ツール':                          '小型SaaS/ツール',
  'UGCプラットフォーム量産系':             'UGC量産',
  'Claude Code SNS自動化系':              'Claude Code SNS自動化',
  'AI架空人格・AIインフルエンサー系':       'AIインフルエンサー',
  'AI音楽カタログ販売系':                  'AI音楽カタログ',
  '市場・物件・商品スクリーニング系':       '市場スクリーニング',
  'マーケティング / EC運用OS系':           'マーケ/EC自動化',
  'その他':                               '汎用AI自動化',
  '未分類':                               '汎用AI自動化',
};

function categoryDisplayName(cat) {
  return CATEGORY_DISPLAY_NAMES[cat] || cat;
}

// ── 転用テンプレート（10市場）────────────────────────────

const TEMPLATES = [
  {
    market: '投資/MT5',
    for: ['SEO/コンテンツ', 'SaaS/ツール', 'SNS自動化', 'その他', 'AI_AGENT_OS_OR_SKILL_REPO'],
    generate: c => ({
      idea:          `MT5インジケーター・トレード手法のClaude Code自動解説ツール`,
      pain:          'MT5の複雑な設定・MQL5コードを理解できない初心者が多い',
      mvp:           'Claude Codeで人気インジのREADME＋サンプルコードを自動生成するCLIスクリプト',
      distribution:  'MQL5.comフォーラム, Zenn, X (#MT5 #FX自動売買)',
      monetization:  '記事→メルマガ→有料テンプレート(3000〜5000円)/コーチング誘導',
      metric:        '記事への質問数・メルマガ登録数',
      effort: 4, cost: 0, risk: '低', upside: '月3〜10万（教材・コーチング）',
    }),
  },
  {
    market: 'XAUUSD',
    for: ['SEO/コンテンツ', 'SNS自動化', 'Polymarket', 'その他'],
    generate: c => ({
      idea:          `XAUUSD相場ファンダ整理レポートの下書き生成ツール（学習・情報整理用、投資助言ではない）`,
      pain:          'ゴールドトレーダーは毎朝同じファンダ確認作業を繰り返しているが、整理に時間がかかる',
      mvp:           'Claude Codeで「主要指標・報道・価格帯メモ」を入力すると分析下書きMarkdownを生成するスクリプト。投稿は人間が確認後に手動で行う',
      distribution:  'note（学習記事）, Zenn, X（手動投稿のみ）',
      monetization:  '学習コンテンツ→フォロワー獲得→有料分析ノート（月980〜2980円）',
      metric:        'note記事のLike数・フォロワー増加数',
      effort: 3, cost: 0, risk: '低', upside: '月3〜15万（コンテンツ運用後）',
    }),
  },
  {
    market: 'Polymarket',
    for: ['Polymarket', 'SaaS/ツール', 'SEO/コンテンツ', 'その他', 'PLATFORM_ENGAGEMENT_PORTFOLIO'],
    generate: c => ({
      idea:          `Polymarket予測確率ビジュアライザー（観察・分析専用、取引なし）`,
      pain:          '生のAPIデータは見づらい。確率変動のトレンドをグラフで見たい',
      mvp:           'Polymarket公開APIで上位30市場の確率変動をCSV+matplotlib グラフに自動変換',
      distribution:  'GitHub（MIT公開）, Polymarket Discord, r/Polymarket',
      monetization:  'OSS公開→認知獲得→有料分析レポートorコーチング誘導',
      metric:        'GitHubスター数・Discord言及数',
      effort: 4, cost: 0, risk: '低', upside: '認知獲得・将来の有料転換',
    }),
  },
  {
    market: 'AI画像販売',
    for: ['AI画像販売', 'SaaS/ツール', 'SEO/コンテンツ', 'その他', 'AI_ASSET_CATALOG'],
    generate: c => ({
      idea:          `ニッチ特化のAI画像プロンプト自動生成→Booth出品パイプライン`,
      pain:          '「売れるAI画像のプロンプト」設計が難しく、試行錯誤に時間がかかる',
      mvp:           'Claude Codeでカテゴリ別プロンプトを10種自動生成→DALL-Eで生成→Boothに手動出品',
      distribution:  'Booth, pixiv, X (#AIアート #Claude)',
      monetization:  'デジタルパック販売（500〜3000円）、プロンプト集販売',
      metric:        'Booth売上数・お気に入り数',
      effort: 3, cost: 500, risk: '中', upside: '月1〜5万（ニッチ次第）',
    }),
  },
  {
    market: 'SEOサイト',
    for: ['SEO/コンテンツ', 'SaaS/ツール', 'SNS自動化', 'その他', 'PLATFORM_ENGAGEMENT_PORTFOLIO', 'MULTI_PLATFORM_PRODUCT_REPURPOSING'],
    generate: c => ({
      idea:          `低競合キーワード特化のSEOミニサイト記事構成自動生成スクリプト`,
      pain:          '記事のSEO最適化に時間がかかりすぎる。構成案作成が面倒',
      mvp:           'Claude Codeで「キーワード→構成→メタタグ→FAQ」を一括生成するCLIスクリプト作成',
      distribution:  'Zenn, note, X (#ブログ #SEO #アフィリエイト)',
      monetization:  'アフィリエイト・Googleアドセンス・スクリプト有料化（3000円〜）',
      metric:        'GSCでのオーガニック流入数',
      effort: 6, cost: 0, risk: '低', upside: '月3〜20万（記事数次第）',
    }),
  },
  {
    market: 'ゲームルール解説サイト',
    for: ['SaaS/ツール', 'SNS自動化', 'AI画像販売', 'SEO/コンテンツ', 'その他', 'PLATFORM_ENGAGEMENT_PORTFOLIO', 'AI_PERSONA_CHARACTER_SYSTEM'],
    generate: c => ({
      idea:          `複雑なゲームルールをAIで即解説するFAQサイト（検索流入特化）`,
      pain:          '遊戯王・MTG・ボドゲ等の複雑なルールを短時間で調べたい',
      mvp:           'Claude Codeで「ゲーム名+よくある質問」のFAQを100問自動生成→静的サイト公開',
      distribution:  'Google自然検索（ゲーム名+ルール）, X (#ゲーム #ボードゲーム)',
      monetization:  'アドセンス・Amazonアフィリエイト（ゲームページへのリンク）',
      metric:        '月間PV数・検索順位',
      effort: 5, cost: 0, risk: '低', upside: '月1〜10万（PV次第）',
    }),
  },
  {
    market: 'Claude Code初心者向け教材',
    for: null, // 全カテゴリ対象
    generate: c => ({
      idea:          `「${categoryDisplayName(c.category) || 'AI自動化'}をClaude Codeで実現する」入門チュートリアル`,
      pain:          'Claude Codeを使いたいが何から始めればよいか・何が作れるか分からない',
      mvp:           'この事例を再現するステップバイステップのZenn/note記事を1本書いて反応を確認',
      distribution:  'Zenn, note, X (#ClaudeCode #AI副業 #Claude)',
      monetization:  '無料記事→フォロワー獲得→有料記事/教材(500〜5000円)→コーチング',
      metric:        '記事PV数・いいね数・コメント数・フォロワー増加',
      effort: 3, cost: 0, risk: '低', upside: '月3〜30万（フォロワー数次第）',
    }),
  },
  {
    market: '業務自動化テンプレート',
    for: ['SaaS/ツール', 'SNS自動化', 'SEO/コンテンツ', 'その他',
          'PLATFORM_ENGAGEMENT_PORTFOLIO', 'AI_AGENT_OS_OR_SKILL_REPO',
          'MULTI_PLATFORM_PRODUCT_REPURPOSING', 'AI_ASSET_CATALOG', 'AI_PERSONA_CHARACTER_SYSTEM'],
    generate: c => ({
      idea:          `${c.automation_target || 'AI活用'}を再現できるClaude Codeプロンプトテンプレート集`,
      pain:          '業務を自動化したいがコードが書けない。どんなプロンプトを書けばいいか分からない',
      mvp:           'この事例を再現する.mdプロンプトテンプレートを1個作りGitHubに公開',
      distribution:  'GitHub（MIT公開）, Zenn, note, X',
      monetization:  'GitHubスポンサー・有料テンプレート集（500〜5000円）・受託案件集客',
      metric:        'GitHubスター数・フォーク数',
      effort: 2, cost: 0, risk: '低', upside: '認知獲得・受託案件',
    }),
  },
  {
    market: '小型SaaS/ツール販売',
    for: ['SaaS/ツール', 'SEO/コンテンツ', 'Polymarket', 'その他',
          'AI_AGENT_OS_OR_SKILL_REPO', 'AI_ASSET_CATALOG', 'PLATFORM_ENGAGEMENT_PORTFOLIO'],
    generate: c => ({
      idea:          `${c.automation_target || 'AI自動化'}専用の小型CLIツール→有料化`,
      pain:          '専用GUIツールがない。毎回同じスクリプトを書き直している',
      mvp:           'Claude CodeでCLIツールを作りGitHub公開→Star数・反応を見て有料化判断',
      distribution:  'Product Hunt, Indie Hackers, GitHub, Zenn',
      monetization:  '買い切り（3000〜15000円）or月額サブスク（500〜3000円）',
      metric:        'GitHubスター数・有料ユーザー数',
      effort: 8, cost: 0, risk: '中', upside: '月5〜50万（ユーザー数次第）',
    }),
  },
  {
    market: 'YouTube/X発信コンテンツ',
    for: null, // 全カテゴリ対象
    generate: c => ({
      idea:          `「${(c.claim || '').slice(0, 25)}…」の実演・解説コンテンツ`,
      pain:          'Claude Codeの実用例を具体的に見たい。自分でも試せるか知りたい',
      mvp:           'この事例を再現するX投稿スレッドor短い動画を1本作成して反応を確認（所要2h）',
      distribution:  'X（スレッド形式）, YouTube（shorts）, note',
      monetization:  'フォロワー→コーチング→教材→スポンサー収益',
      metric:        'インプレッション数・フォロワー増加・リプライ数',
      effort: 2, cost: 0, risk: '低', upside: '認知獲得・フォロワー→将来収益',
    }),
  },
  // ── v2.2 新カテゴリ専用テンプレート ────────────────────────
  {
    market: 'プラットフォーム参加型コンテンツ',
    for: ['PLATFORM_ENGAGEMENT_PORTFOLIO'],
    generate: c => ({
      idea:          `AIでコンセプト・スクリプト・メタデータを量産しプラットフォーム内engagementポートフォリオを構築`,
      pain:          'バイラルヒット1本を狙うのは確率が低い。複数本を量産・改善するほうが安定する',
      mvp:           'Claude Codeでマップ/動画/コンテンツのコンセプト案を10本生成→1本を完成させてプラットフォームに投稿',
      distribution:  'Fortnite UEFN / Roblox / YouTube Shorts / Minecraftサーバー / Steam Workshop',
      monetization:  'プラットフォームのengagement配分（Creator Economy / Creator Fund / 広告収益）',
      metric:        '投稿後のDAU・滞在時間・リテンション・配分収益額',
      effort: 4, cost: 0, risk: '中', upside: '月1〜20万（ポートフォリオ成長後）',
    }),
  },
  {
    market: '業務知識スキルOS',
    for: ['AI_AGENT_OS_OR_SKILL_REPO'],
    generate: c => ({
      idea:          `専門ドメインの思考順序をcontext.md/skill.md/red-flags.mdに構造化しAI業務OSを構築`,
      pain:          'AIに毎回ゼロから指示するのは非効率。専門家の判断基準をAIに読ませて再現したい',
      mvp:           'AI Income Lab用の income-context.md / idea-evaluation-context.md を1ファイル作成してClaude Codeで動かす',
      distribution:  'GitHub（MIT公開）, Zenn, note, X',
      monetization:  'テンプレート集販売（500〜5000円）・コンサル誘導・受託ツール開発',
      metric:        'GitHubスター数・Zenn記事PV',
      effort: 3, cost: 0, risk: '低', upside: '認知獲得→受託案件・月3〜10万',
    }),
  },
  {
    market: 'マルチ販路展開',
    for: ['MULTI_PLATFORM_PRODUCT_REPURPOSING'],
    generate: c => ({
      idea:          `1つのデジタルコンテンツをBOOTH/note/Gumroad/Etsy/Shopify/Kindleなど複数販路で同時展開`,
      pain:          '1つ作っても1箇所でしか売れていない。同じものを複数の購買層に届けたい',
      mvp:           'Claude Codeで1商品アイデアから各プラットフォーム向けの説明文・価格・タグを一括生成',
      distribution:  'BOOTH, note, Gumroad, Etsy, Shopify, Kindle, Udemy',
      monetization:  'デジタルコンテンツ直販（各プラットフォームの手数料控除後）',
      metric:        '各プラットフォームの売上・CVR・PV数',
      effort: 3, cost: 0, risk: '中', upside: '月2〜15万（販路×商品数の積み上げ）',
    }),
  },
  {
    market: 'AIアセットカタログ販売',
    for: ['AI_ASSET_CATALOG'],
    generate: c => ({
      idea:          `AIで素材（BGM/画像/テンプレ/プロンプト）を大量生成しカタログ化して複数販路で収益化`,
      pain:          '1点ずつ作って1点ずつ売るのは非効率。検索・ライセンス・一括購入できるカタログが欲しい',
      mvp:           'Claude Codeでプロンプトを50本生成→Suno/DALL-Eで生成→AudioJungle/Boothに出品テスト',
      distribution:  'AudioJungle, Pond5, Booth, Gumroad, YouTube（BGM提供）',
      monetization:  'Stock販売・Sync License・ストリーミング収益・プロンプト集販売',
      metric:        '出品数・月間ダウンロード数・売上額',
      effort: 4, cost: 500, risk: '中', upside: '月1〜10万（カタログ規模次第）',
    }),
  },
  {
    market: 'AIキャラ/ペルソナシステム',
    for: ['AI_PERSONA_CHARACTER_SYSTEM'],
    generate: c => ({
      idea:          `安全なAIキャラクター（VTuber/教育キャラ/ゲームNPC）をpersona.mdで設計・継続運用`,
      pain:          'SNSキャラやVTuberの設定崩れ・一貫性確保・毎日の投稿考案が大変',
      mvp:           'Claude Codeでpersona.md/voice.md/brain.mdを自動生成しSNS投稿下書きを1週間分作成',
      distribution:  'X, YouTube, Twitch, VRChat, ゲーム内NPC設計',
      monetization:  '会員サポート・グッズ販売・コラボ依頼・ゲームアセット販売',
      metric:        'フォロワー数・サポーター数・エンゲージメント率',
      effort: 4, cost: 0, risk: '中', upside: '月1〜20万（ファンベース拡大後）',
    }),
  },
];

// ── 優先度スコア ──────────────────────────────────────────

function calcPriority(signal, tmpl, c) {
  let s = 30;

  // ── シグナルタイプ（証拠・信頼度を反映）────────────────
  if (signal === 'pain_signal')      s += 25; // 最も実行価値が高い
  if (signal === 'capability_demo')  s += 20; // GitHubなど証拠あり
  if (signal === 'revenue_claim')    s -= 5;  // 未検証収益主張は減点
  if (signal === 'suspicious_claim') s -= 20;

  // ── 自分の強みジャンルとの接続（タイブレーカー。最大8点）───
  // ※ シグナル・工数・リスクが主ドライバー。市場名だけで上位に来ないよう控えめに設定
  const AFFINITY = {
    'Polymarket':              8,  // 予測市場の知識あり
    'Claude Code初心者向け教材': 8,  // 実際に使っている強み
    'SEOサイト':               7,  // SEO × AI の知識あり
    '投資/MT5':                6,  // MT5の知識あり（投資系の一角）
    'XAUUSD':                  6,  // XAUUSD相場への理解（投資系の一角）
  };
  s += AFFINITY[tmpl.market] || 0;

  // ── リスク・工数 ─────────────────────────────────────────
  const idea = tmpl.generate(c);
  if (idea.risk === '低') s += 10;
  if (idea.risk === '高') s -= 15;
  if (idea.effort <= 2)   s += 15; // 2h以内は高優先
  else if (idea.effort <= 3) s += 8;
  if (idea.effort >= 8)   s -= 12; // 大工数は大きくペナルティ

  // ── 自動投稿・自動売買含意のペナルティ ──────────────────
  const ideaName = idea.idea || '';
  if (/自動配信|配信パイプライン|自動投稿|自動売買|自動取引/.test(ideaName)) s -= 20;

  // ── 収益導線の明確さボーナス ────────────────────────────
  const mon = idea.monetization || '';
  if (/サブスク|月額|買い切り|教材|テンプレート/.test(mon)) s += 5;

  // ── ケーススコアの軽微な寄与 ────────────────────────────
  s += Math.round((Number(c.score) || 0) / 15);

  return Math.min(100, Math.max(0, s));
}

// ── アイデア生成（ケースごと）────────────────────────────

function generateIdeasForCase(c) {
  const signal  = detectSignal(c);
  const pattern = PATTERNS[c.category] || PATTERNS['その他'];
  const results = [];

  for (const tmpl of TEMPLATES) {
    // 情報商材は教材・コンテンツ系のみ
    if (signal === 'suspicious_claim' &&
        !['Claude Code初心者向け教材', 'YouTube/X発信コンテンツ', 'AIキャラ/ペルソナシステム'].includes(tmpl.market)) continue;

    // カテゴリフィルタ（null = 全対象）
    if (tmpl.for !== null && !tmpl.for.includes(c.category)) continue;

    const idea     = tmpl.generate(c);
    const priority = calcPriority(signal, tmpl, c);

    results.push({
      source_case_id:     c.id,
      original_case_title: (c.claim || '').slice(0, 60),
      signal_type:        signal,
      extracted_pattern:  pattern.pattern,
      target_market:      tmpl.market,
      customer_pain:      idea.pain,
      derived_idea:       idea.idea,
      monetization_method: idea.monetization,
      mvp_description:    idea.mvp,
      initial_distribution: idea.distribution,
      success_metric:     idea.metric,
      effort_hours:       idea.effort,
      cost_yen:           idea.cost,
      risk_level:         idea.risk,
      expected_upside:    idea.upside,
      priority_score:     priority,
      status:             '未着手',
      created_date:       new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }),
    });
  }

  return results.sort((a, b) => b.priority_score - a.priority_score);
}

// ── 重複排除（同一 derived_idea は最高スコアのみ残す）────────

function deduplicateIdeas(ideas) {
  const best = new Map();
  for (const idea of ideas) {
    // 市場名＋アイデア名の組み合わせをキーにする
    const key = `${idea.target_market}::${idea.derived_idea}`;
    if (!best.has(key) || best.get(key).priority_score < idea.priority_score) {
      best.set(key, idea);
    }
  }
  return [...best.values()].sort((a, b) => b.priority_score - a.priority_score);
}

// ── ジャンルグループ定義 ──────────────────────────────────

const GENRE_GROUPS = [
  { label: '投資/MT5/XAUUSD',        markets: ['投資/MT5', 'XAUUSD'],                                              icon: '📈' },
  { label: 'Polymarket',              markets: ['Polymarket'],                                                     icon: '🎯' },
  { label: 'SEO / Claude Code教材',   markets: ['SEOサイト', 'Claude Code初心者向け教材'],                           icon: '📚' },
  { label: 'AI画像販売',              markets: ['AI画像販売'],                                                      icon: '🎨' },
  { label: 'ゲーム / 教育サイト',     markets: ['ゲームルール解説サイト'],                                            icon: '🎮' },
  { label: '業務自動化 / 小型ツール', markets: ['業務自動化テンプレート', '小型SaaS/ツール販売', 'YouTube/X発信コンテンツ'], icon: '⚙️' },
];

// ── ジャンル別TOP3ブロック生成 ───────────────────────────

function buildGenreSection(allIdeas) {
  return GENRE_GROUPS.map(group => {
    const grouped = allIdeas
      .filter(i => group.markets.includes(i.target_market))
      .sort((a, b) => b.priority_score - a.priority_score)
      .slice(0, 3);

    if (grouped.length === 0) {
      return `### ${group.icon} ${group.label} TOP3\n\n> このジャンルのアイデアはまだありません。\n`;
    }

    const rows = grouped.map((idea, i) =>
      `**${i + 1}. ${idea.derived_idea}**\n` +
      `- 優先度: ${idea.priority_score}点 | 工数: ${idea.effort_hours}h | リスク: ${idea.risk_level} | シグナル: \`${idea.signal_type}\`\n` +
      `- MVP: ${idea.mvp_description}\n` +
      `- 収益化: ${idea.monetization_method}\n`
    ).join('\n');

    return `### ${group.icon} ${group.label} TOP3\n\n${rows}`;
  }).join('\n---\n');
}

// ── XAUUSDバイアスチェック ────────────────────────────────

function buildBiasSection(allIdeas, cases) {
  const sorted   = [...allIdeas].sort((a, b) => b.priority_score - a.priority_score);
  const top10    = sorted.slice(0, Math.min(10, sorted.length));
  const investM  = ['投資/MT5', 'XAUUSD'];
  const investN  = top10.filter(i => investM.includes(i.target_market)).length;
  const investPct = Math.round(investN / top10.length * 100);
  const sampleN  = cases.length; // 全件サンプルデータ由来

  const level =
    investN >= 5 ? '🔴 高（スコアロジックに偏りがある可能性）' :
    investN >= 3 ? '🟡 中（実データ投入で変化するか確認を）'  :
                   '🟢 適切（現時点で偏りなし）';

  // ジャンル多様性スコア：何ジャンルがTOP10に入っているか
  const topMarkets = new Set(top10.map(i => {
    const g = GENRE_GROUPS.find(g => g.markets.includes(i.target_market));
    return g ? g.label : 'その他';
  }));

  return `## 注意すべき偏り（バイアスチェック）

### XAUUSDバイアスチェック

| 確認項目 | 結果 |
|---------|------|
| TOP${top10.length}中の投資/MT5/XAUUSD件数 | **${investN}件 (${investPct}%)** |
| バイアスレベル | ${level} |
| データソース | サンプルデータ由来 ${sampleN}件・実データ 0件 |
| ジャンル多様性 | TOP${top10.length}に **${topMarkets.size}ジャンル** が存在 |

**投資系が高くなる構造的な理由:**
- 現在のAFFINITY設定で 投資/MT5・XAUUSD は各+6点（最大8点のうち）
- これはシグナル（最大+30）・工数（最大+15）・リスク（+10）より小さいため、主ドライバーではない
- ただし実データが0件のため、pain_signalが入ると順位が大きく変動する

**実データ投入後の期待変化:**
- pain_signal 1件 = +30点加算 → 投資系以外が上位に来る可能性が高い
- GitHub証拠付きの capability_demo が増えると、より多様なジャンルが上位になる
- 今は「サンプルデータの構造がそのままランキングに反映されている」段階`;
}

// ── レポート生成 ──────────────────────────────────────────

function buildReport(cases, allIdeas, date) {
  const signalCounts = {};
  const patternSet   = new Set();
  const trapSet      = new Set();

  cases.forEach(c => {
    const sig = detectSignal(c);
    signalCounts[sig] = (signalCounts[sig] || 0) + 1;
    const pat = PATTERNS[c.category] || PATTERNS['その他'];
    patternSet.add(`**${categoryDisplayName(c.category)}**: ${pat.pattern}`);
    trapSet.add(`**${categoryDisplayName(c.category)}**: ${pat.trap}`);
  });

  const sorted   = [...allIdeas].sort((a, b) => b.priority_score - a.priority_score);
  const top5     = sorted.slice(0, 5);
  const top3exp  = sorted.slice(0, 3);

  // Ideas grouped by case (for detail section)
  const byCase = {};
  allIdeas.forEach(idea => {
    const key = idea.source_case_id;
    if (!byCase[key]) byCase[key] = [];
    byCase[key].push(idea);
  });

  return `# 派生アイデアレポート — ${date}

> 生成: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })} | 分析件数: ${cases.length}件 | 固有アイデア: ${allIdeas.length}件

---

## 総合 TOP5

${top5.map((idea, i) => `### ${i + 1}. ${idea.derived_idea}

| 項目 | 内容 |
|-----|------|
| 転用先ジャンル | **${idea.target_market}** |
| 優先度 | **${idea.priority_score}点** |
| シグナル | \`${idea.signal_type}\` |
| 工数 | ${idea.effort_hours}h |
| リスク | ${idea.risk_level} |
| MVP | ${idea.mvp_description} |
| 成功指標 | ${idea.success_metric} |
| 期待収益 | ${idea.expected_upside} |
`).join('\n')}

---

## ジャンル別 TOP3

${buildGenreSection(allIdeas)}

---

## 今日の重要パターン

### 発見された能力パターン
${[...patternSet].map(p => `- ${p}`).join('\n')}

### シグナル分布
| シグナルタイプ | 件数 | 意味 |
|-------------|-----|------|
| pain_signal（需要シグナル） | **${signalCounts['pain_signal'] || 0}件** | 困っている人の声 ← 最高優先 |
| capability_demo（能力デモ） | **${signalCounts['capability_demo'] || 0}件** | 証拠ある事例 |
| revenue_claim（収益主張） | ${signalCounts['revenue_claim'] || 0}件 | 未検証収益（減点対象） |
| suspicious_claim（疑わしい主張） | ${signalCounts['suspicious_claim'] || 0}件 | 情報商材・高リスク |

> pain_signal が 0件 の場合：実データ収集時に「困りごと投稿」を優先的に集める

### 注意すべき罠
${[...trapSet].map(t => `- ${t}`).join('\n')}

---

${buildBiasSection(allIdeas, cases)}

---

## 次に試すべき小実験 TOP3（1日以内・無料・自動投稿なし）

${top3exp.map((idea, i) => `### 🧪 実験${i + 1}. ${idea.derived_idea}

- **転用先**: ${idea.target_market}
- **優先度**: ${idea.priority_score}点 | **工数**: ${idea.effort_hours}h | **リスク**: ${idea.risk_level}
- **MVP**: ${idea.mvp_description}
- **最初の配布先**: ${idea.initial_distribution}
- **収益化**: ${idea.monetization_method}
- **成功指標**: ${idea.success_metric}
- **期待収益**: ${idea.expected_upside}
`).join('\n')}

---

## 派生アイデア詳細（全件）

${Object.entries(byCase).map(([caseId, ideas]) => {
  const c   = cases.find(x => x.id === caseId) || {};
  const sig = detectSignal(c);
  const pat = PATTERNS[c.category] || PATTERNS['その他'];
  return `### Case ${caseId}: ${(c.claim || '').slice(0, 50)}…

**シグナルタイプ**: \`${sig}\` | **カテゴリ**: ${categoryDisplayName(c.category)}

| 分析項目 | 内容 |
|--------|------|
| 本質的な能力 | ${pat.pattern} |
| 人が反応した理由 | ${pat.reaction} |
| 悩みを持つ人 | ${pat.who} |
| 注意すべき罠 | ${pat.trap} |

${ideas.slice(0, 3).map(idea =>
  `**→ ${idea.target_market}（${idea.priority_score}点）**: ${idea.derived_idea}\n` +
  `  - MVP: ${idea.mvp_description}\n` +
  `  - 収益化: ${idea.monetization_method} | 工数: ${idea.effort_hours}h | リスク: ${idea.risk_level}`
).join('\n')}
`;
}).join('\n---\n')}

---

*Generated by AI Income Lab v1.0 — pain_signal が増えるほどアイデアの精度が上がります*
`;
}

// ── ideas.csv 書き出し ────────────────────────────────────

const IDEAS_HEADERS = [
  'id', 'source_case_id', 'original_case_title', 'signal_type', 'extracted_pattern',
  'target_market', 'customer_pain', 'derived_idea', 'monetization_method',
  'mvp_description', 'initial_distribution', 'success_metric',
  'effort_hours', 'cost_yen', 'risk_level', 'expected_upside',
  'priority_score', 'status', 'created_date',
];

function writeIdeasCsv(ideas) {
  const rows = [
    IDEAS_HEADERS.join(','),
    ...ideas.map((idea, i) => IDEAS_HEADERS.map(h => {
      if (h === 'id') return i + 1;
      return escapeCell(idea[h]);
    }).join(',')),
  ];
  fs.writeFileSync(IDEAS_CSV, rows.join('\n'), 'utf8');
}

// ── エントリーポイント ────────────────────────────────────

function main() {
  console.log('=== AI Income Lab: Idea Generator ===\n');

  if (!fs.existsSync(CASES_CSV)) {
    console.error('❌ cases.csv が見つかりません。先に npm run analyze を実行してください。');
    process.exit(1);
  }

  const cases = parseCsv(fs.readFileSync(CASES_CSV, 'utf8'));
  if (cases.length === 0) {
    console.warn('⚠️  分析済み事例が0件です。');
    return;
  }

  // 全アイデア生成
  const rawIdeas = [];
  cases.forEach(c => {
    const ideas = generateIdeasForCase(c);
    rawIdeas.push(...ideas);
    console.log(`  💡 Case ${c.id} (${categoryDisplayName(c.category)}): ${ideas.length}件のアイデアを生成`);
  });

  // 重複排除（同一 derived_idea は最高スコアのものだけ残す）
  const allIdeas = deduplicateIdeas(rawIdeas);
  const dropped  = rawIdeas.length - allIdeas.length;
  if (dropped > 0) console.log(`  🔀 重複排除: ${dropped}件を統合 → ${allIdeas.length}件の固有アイデア`);

  // ideas.csv 書き出し
  writeIdeasCsv(allIdeas);
  console.log(`\n📊 ${allIdeas.length}件のアイデアを ${IDEAS_CSV} に保存`);

  // レポート生成
  const today  = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
  const report = buildReport(cases, allIdeas, today);

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const out = path.join(REPORT_DIR, `${today}-ideas.md`);
  fs.writeFileSync(out, report, 'utf8');

  console.log(`✅ アイデアレポートを生成: ${out}`);

  // サマリー表示
  const top = [...allIdeas].sort((a, b) => b.priority_score - a.priority_score)[0];
  if (top) {
    console.log(`\n🏆 最高優先度アイデア: ${top.derived_idea}`);
    console.log(`   転用先: ${top.target_market} | 優先度: ${top.priority_score}点 | 工数: ${top.effort_hours}h`);
  }
}

main();
