#!/usr/bin/env node
// run_demo.js — 安全版デモ実行スクリプト (v2.3.9)
//
// 動作：
//   1. 既存の input.txt があれば一時バックアップ
//   2. input.example.txt を一時的に input.txt としてコピー
//   3. evaluate_idea.js → report.js → idea.js を実行
//   4. 元の input.txt を復元（エラー時も finally で必ず復元）
//
// 実運用 input.txt を削除・上書き破壊しません。
// 既存の collect / input / evaluate / daily パイプラインは変更しません。
'use strict';

const { spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

// package.json からバージョンを読み込む
const PKG_VERSION = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')).version;
  } catch { return '?.?.?'; }
})();

const ROOT        = path.join(__dirname, '..');
const INPUT_FILE  = path.join(ROOT, 'input.txt');
const EXAMPLE_FILE = path.join(ROOT, 'input.example.txt');
const BACKUP_FILE = path.join(ROOT, 'input.txt.demo_backup');

// ── ヘルパー ──────────────────────────────────────────────────
// execSync は Windows のシェルパス問題を起こすため
// process.execPath（現在の Node.js 実行ファイルのフルパス）で直接呼ぶ
function run(scriptRelPath) {
  const scriptAbs = path.join(ROOT, scriptRelPath);
  console.log(`\n$ node ${scriptRelPath}`);
  const result = spawnSync(process.execPath, [scriptAbs], {
    cwd:   ROOT,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Script exited with code ${result.status}: ${scriptRelPath}`);
  }
}

function banner(msg) {
  const line = '─'.repeat(60);
  console.log(`\n${line}\n  ${msg}\n${line}`);
}

// ── メイン ────────────────────────────────────────────────────
function main() {
  banner(`AI Income Lab v${PKG_VERSION} — 安全版デモ`);

  // input.example.txt の存在確認
  if (!fs.existsSync(EXAMPLE_FILE)) {
    console.error('❌ input.example.txt が見つかりません。');
    console.error('   リポジトリが正しくセットアップされているか確認してください。');
    process.exit(1);
  }

  const hasRealInput = fs.existsSync(INPUT_FILE);
  let restored = false;

  // 実運用 input.txt をバックアップ
  if (hasRealInput) {
    fs.copyFileSync(INPUT_FILE, BACKUP_FILE);
    console.log(`\n📦 実運用 input.txt を一時退避: ${BACKUP_FILE}`);
  }

  try {
    // input.example.txt → input.txt にコピー
    fs.copyFileSync(EXAMPLE_FILE, INPUT_FILE);
    console.log(`📄 input.example.txt をデモ用に input.txt としてコピー`);
    console.log(`   （実運用データには影響しません）\n`);

    // パイプライン実行
    banner('Step 1/3: evaluate_idea.js を実行');
    run('scripts/evaluate_idea.js');

    banner('Step 2/3: report.js を実行');
    run('scripts/report.js');

    banner('Step 3/3: idea.js を実行');
    run('scripts/idea.js');

    banner('✅ デモ完了');
    console.log('生成されたファイル:');
    console.log('  📄 analysis.md         — 評価レポート');
    console.log('  📊 results/cases.csv   — 評価済み事例DB');
    console.log('  💡 results/ideas.csv   — 派生アイデアDB');
    console.log('  📁 reports/daily/      — 日次レポート');
    console.log('\nこれらは .gitignore で除外されているため、GitHub には公開されません。');

  } catch (err) {
    console.error('\n❌ デモ実行中にエラーが発生しました:', err.message);
  } finally {
    // 必ず元の input.txt を復元
    if (hasRealInput && fs.existsSync(BACKUP_FILE)) {
      fs.copyFileSync(BACKUP_FILE, INPUT_FILE);
      fs.unlinkSync(BACKUP_FILE);
      console.log('\n♻️  実運用 input.txt を復元しました');
      restored = true;
    } else if (!hasRealInput) {
      // もともと input.txt がなかった場合はデモ用コピーを削除
      if (fs.existsSync(INPUT_FILE)) {
        fs.unlinkSync(INPUT_FILE);
        console.log('\n🗑️  デモ用 input.txt を削除しました（元からファイルなし）');
      }
      restored = true;
    }
  }

  if (restored || !hasRealInput) {
    console.log('\n✅ 実運用 input.txt への影響なし');
  } else {
    console.warn('\n⚠️  input.txt の復元を確認してください: input.txt.demo_backup');
  }
}

main();
