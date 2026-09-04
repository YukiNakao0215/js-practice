/** 取得結果を「ノートに載せる記事一覧」に変換する（正規化・重複排除・タグ付け） */

const TRACKING_PARAMS = [
  /^utm_/i, /^fbclid$/i, /^gclid$/i, /^mc_(cid|eid)$/i,
  /^ncid$/i, /^cmpid$/i, /^ref$/i, /^ref_src$/i, /^__twitter_impression$/i,
  /^guccounter$/i, /^guce_referrer/i, /^sh$/i,
];

/** 追跡パラメータやフラグメントを落として比較可能なURLにする */
export function canonicalizeUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    url.hash = '';
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMS.some((pattern) => pattern.test(key))) url.searchParams.delete(key);
    }
    url.search = url.searchParams.toString() ? `?${url.searchParams.toString()}` : '';
    if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.slice(0, -1);
    }
    return url.toString();
  } catch {
    return rawUrl.trim();
  }
}

/** 同一ニュースを別媒体が転載した場合に気付けるよう、タイトルも比較キーにする */
export function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/[\s　]+/g, '')
    .replace(/[!-/:-@[-`{-~、。「」『』・…—–]/g, '');
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * エイリアス一致を判定する。
 * ASCIIのみの語は単語境界付き（"Meta" が "metadata" に当たらないように）、
 * 日本語を含む語は単語境界の概念がないので部分一致にする。
 */
function makeMatcher(alias) {
  const isAscii = /^[\x20-\x7e]+$/.test(alias);
  if (isAscii) {
    const pattern = new RegExp(`(?<![\\w-])${escapeRegExp(alias)}(?![\\w-])`, 'i');
    return (text) => pattern.test(text);
  }
  const needle = alias.toLowerCase();
  return (text) => text.toLowerCase().includes(needle);
}

/** 設定のエンティティ/トピック定義をマッチャ付きに前処理する */
export function compileTerms(definitions) {
  return definitions.map((definition) => ({
    name: definition.name,
    tag: definition.tag,
    matchers: (definition.aliases || [definition.name]).map(makeMatcher),
  }));
}

function detect(terms, text) {
  return terms.filter((term) => term.matchers.some((match) => match(text)));
}

function truncate(text, maxChars) {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 1).trimEnd()}…`;
}

/**
 * 取得結果から記事一覧を組み立てる。
 * @param {Array} fetchResults fetchFeeds の戻り値
 * @param {object} config
 * @param {{ now: Date, isSeen: (key: string) => boolean }} context
 */
export function collectArticles(fetchResults, config, { now, isSeen }) {
  const entities = compileTerms(config.entities);
  const topics = compileTerms(config.topics);
  const excludes = (config.excludeKeywords || []).map((word) => word.toLowerCase());
  const windowStart = new Date(now.getTime() - config.windowHours * 3600 * 1000);

  const seenInThisRun = new Set();
  const articles = [];
  const stats = { fetched: 0, outOfWindow: 0, duplicate: 0, alreadySeen: 0, excluded: 0 };

  for (const result of fetchResults) {
    let takenFromFeed = 0;

    for (const item of result.items) {
      stats.fetched += 1;
      if (takenFromFeed >= config.maxItemsPerFeed) continue;

      // 日付が取れない記事は「未読なら載せる」扱いにする（切り捨てると公式ブログを取りこぼす）
      if (item.published && (item.published < windowStart || item.published > new Date(now.getTime() + 86400000))) {
        stats.outOfWindow += 1;
        continue;
      }

      const url = canonicalizeUrl(item.link);
      const titleKey = `title:${normalizeTitle(item.title)}`;
      if (seenInThisRun.has(url) || seenInThisRun.has(titleKey)) {
        stats.duplicate += 1;
        continue;
      }
      if (isSeen(url) || isSeen(titleKey)) {
        stats.alreadySeen += 1;
        continue;
      }

      const haystack = `${item.title} ${item.summary}`;
      if (excludes.some((word) => haystack.toLowerCase().includes(word))) {
        stats.excluded += 1;
        continue;
      }

      seenInThisRun.add(url);
      seenInThisRun.add(titleKey);
      takenFromFeed += 1;

      articles.push({
        title: item.title,
        url,
        published: item.published,
        summary: truncate(item.summary, config.summaryMaxChars),
        source: result.feed.name,
        category: result.feed.category || 'その他',
        lang: result.feed.lang || 'en',
        entities: detect(entities, haystack),
        topics: detect(topics, haystack),
        keys: [url, titleKey],
      });
    }
  }

  // 新しい順。日付不明は末尾に置く。
  articles.sort((a, b) => {
    if (a.published && b.published) return b.published - a.published;
    if (a.published) return -1;
    if (b.published) return 1;
    return 0;
  });

  return { articles: articles.slice(0, config.maxItemsTotal), stats };
}
