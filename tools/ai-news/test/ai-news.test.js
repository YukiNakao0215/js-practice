import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { parseFeed, stripHtml, decodeEntities } from '../src/parse.js';
import { canonicalizeUrl, normalizeTitle, collectArticles, compileTerms } from '../src/collect.js';
import { renderNote } from '../src/render.js';
import { loadState, isSeenIn, updateState, saveState } from '../src/state.js';
import { formatDate } from '../src/time.js';
import { DEFAULT_CONFIG } from '../src/defaults.js';

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

/** 固定ファイルの __RECENT__ を「いま」に差し替えて時間依存を消す */
function loadFixture(name) {
  const raw = fs.readFileSync(path.join(fixturesDir, name), 'utf8');
  return raw.replaceAll('__RECENT__', new Date(Date.now() - 3600 * 1000).toUTCString());
}

const testConfig = {
  ...DEFAULT_CONFIG,
  timezone: 'Asia/Tokyo',
  excludeKeywords: ['sponsored'],
  feeds: [
    { name: 'Example EN', url: 'https://example.com/feed', category: '英語メディア', lang: 'en' },
    { name: 'Example JA', url: 'https://example.jp/feed', category: '日本語メディア', lang: 'ja' },
  ],
};

function buildResults() {
  return [
    { feed: testConfig.feeds[0], items: parseFeed(loadFixture('rss.xml')).items, error: null },
    { feed: testConfig.feeds[1], items: parseFeed(loadFixture('atom.xml')).items, error: null },
  ];
}

test('decodeEntities: 名前付き・10進・16進の実体参照を戻す', () => {
  assert.equal(decodeEntities('a &amp; b &#65; &#x42; &unknown;'), 'a & b A B &unknown;');
});

test('stripHtml: エスケープされたHTMLもタグを落とす', () => {
  assert.equal(stripHtml('&lt;p&gt;Hello &lt;b&gt;world&lt;/b&gt;&#x27;s&lt;/p&gt;'), "Hello world's");
});

test('parseFeed: RSSからタイトル・URL・日付を取り出す', () => {
  const parsed = parseFeed(loadFixture('rss.xml'));
  assert.equal(parsed.feedTitle, 'Example AI News');
  assert.equal(parsed.items.length, 3);
  assert.equal(parsed.items[0].title, 'OpenAI & NVIDIA announce partnership');
  assert.match(parsed.items[0].summary, /^OpenAI and NVIDIA said the deal/);
});

test('parseFeed: Atomの rel="self" ではなく alternate を記事URLにする', () => {
  const parsed = parseFeed(loadFixture('atom.xml'));
  assert.equal(parsed.items[0].link, 'https://www.example.jp/entry/openai-nvidia/');
});

test('parseFeed: 壊れた入力でも例外を投げずに空を返す', () => {
  assert.deepEqual(parseFeed('<html>not a feed</html>').items, []);
  assert.deepEqual(parseFeed('').items, []);
});

test('canonicalizeUrl: 追跡パラメータ・www・末尾スラッシュを正規化する', () => {
  assert.equal(
    canonicalizeUrl('https://www.example.com/a/?utm_source=rss&id=7#top'),
    'https://example.com/a?id=7',
  );
});

test('normalizeTitle: 記号と空白の差を吸収する', () => {
  assert.equal(normalizeTitle('OpenAI & NVIDIA、提携'), normalizeTitle('openai  &nvidia 提携'));
});

test('compileTerms: 単語境界により部分語の誤検出を避ける', () => {
  const [meta] = compileTerms([{ name: 'Meta AI', tag: 'ai/meta', aliases: ['Meta'] }]);
  assert.equal(meta.matchers.some((m) => m('Meta released a model')), true);
  assert.equal(meta.matchers.some((m) => m('metadata handling')), false);
});

test('collectArticles: 期間外・除外語・重複を落とす', () => {
  const now = new Date();
  const { articles, stats } = collectArticles(buildResults(), testConfig, { now, isSeen: () => false });
  const titles = articles.map((article) => article.title);

  assert.equal(titles.includes('Old article that should be filtered out'), false, '期間外が残っている');
  assert.equal(titles.includes('Sponsored: buy our course'), false, '除外語が効いていない');
  assert.equal(articles.length, 3);
  assert.equal(stats.outOfWindow, 1);
  assert.equal(stats.excluded, 1);
});

test('collectArticles: エンティティとトピックを検出する', () => {
  const { articles } = collectArticles(buildResults(), testConfig, { now: new Date(), isSeen: () => false });
  const target = articles.find((article) => article.title.includes('OpenAI &'));
  const names = target.entities.map((entity) => entity.name);
  assert.ok(names.includes('OpenAI'));
  assert.ok(names.includes('NVIDIA'));
  assert.ok(target.topics.some((topic) => topic.tag === 'ai/infra'));
});

test('collectArticles: 既出の記事は除外される', () => {
  const results = buildResults();
  const first = collectArticles(results, testConfig, { now: new Date(), isSeen: () => false });
  const seen = new Set(first.articles.flatMap((article) => article.keys));
  const second = collectArticles(results, testConfig, {
    now: new Date(),
    isSeen: (key) => seen.has(key),
  });
  assert.equal(second.articles.length, 0);
});

test('collectArticles: maxItemsPerFeed で1媒体の占有を防ぐ', () => {
  const config = { ...testConfig, maxItemsPerFeed: 1 };
  const { articles } = collectArticles(buildResults(), config, { now: new Date(), isSeen: () => false });
  assert.equal(articles.filter((article) => article.source === 'Example JA').length, 1);
});

test('renderNote: frontmatter・出典リンク・エラー節を含む', () => {
  const now = new Date();
  const dateString = formatDate(now, testConfig.timezone);
  const { articles, stats } = collectArticles(buildResults(), testConfig, { now, isSeen: () => false });
  const errors = [{ feed: { name: 'Broken', url: 'https://broken.example/feed' }, error: 'HTTP 404 Not Found' }];
  const markdown = renderNote({ articles, stats, errors, dateString, now }, testConfig);

  assert.match(markdown, /^---\ntitle: "AIニュース \d{4}-\d{2}-\d{2}"/);
  assert.match(markdown, /\n {2}- ai\/openai\n/);
  assert.match(markdown, /\[\[OpenAI\]\]/);
  assert.match(markdown, /## 取得エラー/);
  assert.match(markdown, /HTTP 404 Not Found/);
  assert.match(markdown, /\(https:\/\/example\.com\/posts\/openai-nvidia\)/, '原文リンクが無い');
  assert.match(markdown, /前日: \[\[AI-News-/);
});

test('renderNote: 記事0件でも壊れず警告を出す', () => {
  const now = new Date();
  const markdown = renderNote({
    articles: [],
    stats: { fetched: 0, outOfWindow: 0, duplicate: 0, alreadySeen: 0, excluded: 0 },
    errors: [],
    dateString: formatDate(now, testConfig.timezone),
    now,
  }, testConfig);
  assert.match(markdown, /新着記事なし/);
});

test('renderNote: タイトル中の角括弧をエスケープしてリンクを壊さない', () => {
  const now = new Date();
  const markdown = renderNote({
    articles: [{
      title: '[速報] Claude 更新', url: 'https://example.com/x', published: now,
      summary: '', source: 'Example', category: '公式ブログ', lang: 'ja',
      entities: [], topics: [], keys: [],
    }],
    stats: { fetched: 1, outOfWindow: 0, duplicate: 0, alreadySeen: 0, excluded: 0 },
    errors: [], dateString: formatDate(now, testConfig.timezone), now,
  }, testConfig);
  assert.match(markdown, /\*\*\[\\\[速報\\\] Claude 更新\]\(https:\/\/example\.com\/x\)\*\*/);
});

test('state: 保存・読み込みと保持期間による削除', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-news-state-'));
  const statePath = path.join(dir, 'state.json');

  const state = { seen: { 'https://old.example/1': '2026-01-01' } };
  updateState(state, [{ keys: ['https://new.example/1'] }], '2026-09-04', 45);
  saveState(statePath, state);

  const reloaded = loadState(statePath);
  assert.equal(isSeenIn(reloaded)('https://new.example/1'), true);
  assert.equal(isSeenIn(reloaded)('https://old.example/1'), false, '保持期間を過ぎた記録が残っている');

  fs.rmSync(dir, { recursive: true, force: true });
});

test('state: 同日に記録した分は既出扱いしない（--force の再生成が空にならない）', () => {
  const state = { seen: {} };
  updateState(state, [{ keys: ['https://example.com/a'] }], '2026-09-04', 45);
  assert.equal(isSeenIn(state, '2026-09-04')('https://example.com/a'), false);
  assert.equal(isSeenIn(state, '2026-09-05')('https://example.com/a'), true);
});

test('state: 壊れたJSONでも空状態で復帰する', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-news-state-'));
  const statePath = path.join(dir, 'state.json');
  fs.writeFileSync(statePath, '{ broken');
  assert.deepEqual(loadState(statePath), { seen: {} });
  fs.rmSync(dir, { recursive: true, force: true });
});
