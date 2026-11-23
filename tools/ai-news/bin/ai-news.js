#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, assertVaultWritable, findConfigPath } from '../src/config.js';
import { fetchFeeds } from '../src/fetch.js';
import { collectArticles } from '../src/collect.js';
import { renderNote } from '../src/render.js';
import { loadState, isSeenIn, updateState, saveState } from '../src/state.js';
import { formatDate } from '../src/time.js';

const HELP = `AIニュース日次まとめ → Obsidian

使い方:
  ai-news [run]        フィードを取得してノートを書き出す（既定）
  ai-news check        全フィードの疎通と件数だけ確認する（書き込みなし）
  ai-news init         カレントに ai-news.config.json を作る

オプション:
  --config <path>      設定ファイルのパス
  --dry-run            ファイルに書かず、生成されるMarkdownを標準出力に出す
  --force              同じ日のノートが既にあっても上書きする
  --quiet              進捗ログを出さない
  -h, --help           このヘルプ
`;

function parseArgs(argv) {
  const options = { command: 'run', dryRun: false, force: false, quiet: false, config: undefined };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') return { ...options, command: 'help' };
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--force') options.force = true;
    else if (arg === '--quiet') options.quiet = true;
    else if (arg === '--config') options.config = argv[++i];
    else if (arg.startsWith('--config=')) options.config = arg.slice('--config='.length);
    else if (!arg.startsWith('-')) options.command = arg;
    else throw new Error(`不明なオプション: ${arg}`);
  }
  return options;
}

function makeLogger(quiet) {
  return (...args) => {
    if (!quiet) console.error(...args);
  };
}

async function commandCheck(config, log) {
  log(`${config.feeds.length} 件のフィードを確認中...`);
  const results = await fetchFeeds(config.feeds, config);
  let failed = 0;
  for (const result of results) {
    if (result.error) {
      failed += 1;
      console.log(`NG   ${result.feed.name.padEnd(20)} ${result.error}\n     ${result.feed.url}`);
    } else {
      console.log(`OK   ${result.feed.name.padEnd(20)} ${String(result.items.length).padStart(3)} 件  ${result.feed.url}`);
    }
  }
  console.log(`\n成功 ${results.length - failed} / ${results.length}`);
  return failed === results.length ? 2 : 0;
}

function commandInit() {
  const target = path.resolve(process.cwd(), 'ai-news.config.json');
  if (fs.existsSync(target)) {
    console.error(`既に存在します: ${target}`);
    return 1;
  }
  const templatePath = path.join(
    path.dirname(fileURLToPath(import.meta.url)), '..', 'config.example.json',
  );
  fs.copyFileSync(templatePath, target);
  console.log(`作成しました: ${target}`);
  console.log('vaultPath に Obsidian vault の絶対パスを設定してください。');
  return 0;
}

async function commandRun(config, options, log) {
  if (!options.dryRun) assertVaultWritable(config);

  const now = new Date();
  const dateString = formatDate(now, config.timezone);
  const notePath = path.join(config.vaultPath || '', config.notePath.replace('{{date}}', dateString));

  if (!options.dryRun && fs.existsSync(notePath) && !options.force) {
    console.error(`本日のノートは既にあります: ${notePath}\n上書きするには --force を付けてください。`);
    return 0;
  }

  log(`${config.feeds.length} 件のフィードを取得中...`);
  const results = await fetchFeeds(config.feeds, config);
  const errors = results.filter((result) => result.error).map(({ feed, error }) => ({ feed, error }));

  if (errors.length === results.length) {
    console.error('すべてのフィード取得に失敗しました。ネットワーク接続を確認してください。');
    for (const { feed, error } of errors) console.error(`  - ${feed.name}: ${error}`);
    return 2;
  }

  const state = loadState(config.statePath);
  const { articles, stats } = collectArticles(results, config, { now, isSeen: isSeenIn(state, dateString) });
  const markdown = renderNote({ articles, stats, errors, dateString, now }, config);

  if (options.dryRun) {
    process.stdout.write(markdown);
    log(`\n(--dry-run: ファイルは書いていません / 掲載 ${articles.length} 件)`);
    return 0;
  }

  fs.mkdirSync(path.dirname(notePath), { recursive: true });
  fs.writeFileSync(notePath, markdown, 'utf8');
  saveState(config.statePath, updateState(state, articles, dateString, config.stateRetentionDays));

  log(`書き出しました: ${notePath}`);
  log(`掲載 ${articles.length} 件 / 取得 ${stats.fetched} 件 / 失敗フィード ${errors.length} 件`);
  return 0;
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    console.error(HELP);
    return 1;
  }

  if (options.command === 'help') {
    console.log(HELP);
    return 0;
  }
  if (options.command === 'init') return commandInit();

  let config;
  try {
    config = loadConfig(options);
  } catch (error) {
    console.error(error.message);
    return 1;
  }

  const log = makeLogger(options.quiet);
  if (!config.configPath) {
    log('注意: 設定ファイルが見つからないため既定設定で動作します（ai-news init で作成できます）。');
  }

  if (options.command === 'check') return commandCheck(config, log);
  if (options.command === 'run') return commandRun(config, options, log);

  console.error(`不明なコマンド: ${options.command}`);
  console.error(HELP);
  return 1;
}

main()
  .then((code) => { process.exitCode = code; })
  .catch((error) => {
    console.error(error?.stack || String(error));
    process.exitCode = 1;
  });
