import { parseFeed } from './parse.js';

const USER_AGENT = 'ai-news-obsidian/1.0 (+https://github.com/YukiNakao0215/js-practice)';

/** 指定並列数で順に処理する（外部依存を増やさないための最小実装） */
async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

/** 1フィードを取得する。ネットワークエラーは1回だけ再試行する。 */
async function fetchOne(feed, { requestTimeoutMs }) {
  let lastError = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(feed.url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(requestTimeoutMs),
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
        },
      });

      if (!response.ok) {
        // 4xx は再試行しても同じなので即座に諦める
        const error = new Error(`HTTP ${response.status} ${response.statusText}`);
        if (response.status >= 400 && response.status < 500) throw Object.assign(error, { fatal: true });
        throw error;
      }

      const xml = await response.text();
      const parsed = parseFeed(xml);
      if (parsed.items.length === 0) {
        throw Object.assign(new Error('記事を1件も抽出できませんでした（フィード形式が想定外の可能性）'), { fatal: true });
      }
      return { feed, items: parsed.items, feedTitle: parsed.feedTitle, error: null };
    } catch (error) {
      lastError = error;
      if (error.fatal) break;
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return { feed, items: [], feedTitle: '', error: lastError?.message || String(lastError) };
}

/**
 * 全フィードを取得する。1つが落ちても全体は止めず、error を結果に残す。
 * 失敗を握り潰すとノートが静かに痩せていくので、必ず呼び出し側で表示すること。
 */
export function fetchFeeds(feeds, config) {
  return mapWithConcurrency(feeds, config.concurrency, (feed) => fetchOne(feed, config));
}
