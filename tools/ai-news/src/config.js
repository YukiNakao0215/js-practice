import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { DEFAULT_CONFIG } from './defaults.js';

const CONFIG_FILENAME = 'ai-news.config.json';

/** 設定ファイルを探す順番: --config > カレント > ~/.config/ai-news/ */
export function findConfigPath(explicitPath) {
  if (explicitPath) {
    const resolved = path.resolve(explicitPath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`設定ファイルが見つかりません: ${resolved}`);
    }
    return resolved;
  }
  const candidates = [
    path.resolve(process.cwd(), CONFIG_FILENAME),
    path.join(os.homedir(), '.config', 'ai-news', 'config.json'),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (error) {
    // Windowsパスを "C:\obsidian\vault" と書くのが最頻出の原因なので先回りして案内する
    const hint = /\\[^"\\/bfnrtu]/.test(raw)
      ? '\n  ヒント: JSONでは \\ を2つ重ねる必要があります。'
        + '"C:\\\\obsidian\\\\vault" と書くか、スラッシュ区切りの "C:/obsidian/vault" を使ってください。'
      : '';
    throw new Error(`設定ファイルのJSONが不正です: ${filePath}\n  ${error.message}${hint}`);
  }
}

/** name をキーに重複排除しつつ配列を連結する（後勝ち） */
function mergeNamedList(base, override, extra, key) {
  const source = Array.isArray(override) ? override : base;
  const merged = new Map();
  for (const entry of [...source, ...(Array.isArray(extra) ? extra : [])]) {
    if (entry && typeof entry[key] === 'string') merged.set(entry[key], entry);
  }
  return [...merged.values()];
}

/**
 * 既定設定とユーザー設定を合成して、検証済みの設定を返す。
 * @param {{ config?: string }} options
 */
export function loadConfig(options = {}) {
  const configPath = findConfigPath(options.config);
  const userConfig = configPath ? readJson(configPath) : {};
  const baseDir = configPath ? path.dirname(configPath) : process.cwd();

  const config = {
    ...DEFAULT_CONFIG,
    ...userConfig,
    feeds: mergeNamedList(DEFAULT_CONFIG.feeds, userConfig.feeds, userConfig.extraFeeds, 'url'),
    entities: mergeNamedList(DEFAULT_CONFIG.entities, userConfig.entities, userConfig.extraEntities, 'name'),
    topics: mergeNamedList(DEFAULT_CONFIG.topics, userConfig.topics, userConfig.extraTopics, 'name'),
    configPath,
    baseDir,
  };

  // 無効化されたフィードを落とす（設定で enabled: false と書ける）
  config.feeds = config.feeds.filter((feed) => feed.enabled !== false);

  if (config.vaultPath) {
    config.vaultPath = path.resolve(
      config.vaultPath.startsWith('~')
        ? path.join(os.homedir(), config.vaultPath.slice(1))
        : path.resolve(baseDir, config.vaultPath),
    );
  }
  config.statePath = path.resolve(baseDir, config.statePath);

  validate(config);
  return config;
}

function validate(config) {
  const errors = [];

  if (config.feeds.length === 0) {
    errors.push('feeds が空です。少なくとも1つのフィードが必要です。');
  }
  for (const feed of config.feeds) {
    if (!feed.url || !/^https?:\/\//i.test(feed.url)) {
      errors.push(`フィードURLが不正です: ${JSON.stringify(feed)}`);
    }
  }

  if (path.isAbsolute(config.notePath) || config.notePath.split(/[\\/]/).includes('..')) {
    errors.push('notePath は vault 内の相対パスにしてください（絶対パス・".." は不可）。');
  }
  if (!config.notePath.endsWith('.md')) {
    errors.push('notePath は .md で終わる必要があります。');
  }

  for (const key of ['windowHours', 'maxItemsPerFeed', 'maxItemsTotal', 'requestTimeoutMs', 'concurrency', 'summaryMaxChars']) {
    const value = config[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      errors.push(`${key} は正の数値である必要があります（現在: ${JSON.stringify(value)}）。`);
    }
  }

  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: config.timezone });
  } catch {
    errors.push(`timezone が不正です: ${config.timezone}`);
  }

  if (errors.length > 0) {
    throw new Error(`設定エラー:\n- ${errors.join('\n- ')}`);
  }
}

/** vault への書き込み直前の検証。--dry-run では呼ばない。 */
export function assertVaultWritable(config) {
  if (!config.vaultPath) {
    throw new Error(
      'vaultPath が未設定です。ai-news.config.json に Obsidian vault の絶対パスを設定してください。\n' +
      '（出力せず内容だけ確認したい場合は --dry-run を使ってください）',
    );
  }
  if (!fs.existsSync(config.vaultPath)) {
    throw new Error(`vaultPath が存在しません: ${config.vaultPath}`);
  }
  if (!fs.statSync(config.vaultPath).isDirectory()) {
    throw new Error(`vaultPath がディレクトリではありません: ${config.vaultPath}`);
  }
}
