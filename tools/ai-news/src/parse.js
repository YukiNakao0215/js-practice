/**
 * RSS 2.0 / Atom 1.0 の最小パーサ。
 *
 * 外部依存を持たない代わりに、汎用XMLパーサではなく
 * 「RSS/Atomに現れる形」だけを狙って処理している。
 * 未知の形式で壊れた場合は items: [] を返し、呼び出し側でエラー扱いにする。
 */

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’',
  hellip: '…', mdash: '—', ndash: '–', middot: '·', bull: '・',
};

/** &amp; や &#x27; を実文字に戻す */
export function decodeEntities(input) {
  if (!input) return '';
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X'
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return match;
      try {
        return String.fromCodePoint(code);
      } catch {
        return match;
      }
    }
    const named = NAMED_ENTITIES[body.toLowerCase()];
    return named === undefined ? match : named;
  });
}

/** <![CDATA[...]]> の中身を取り出す */
function stripCdata(input) {
  return input.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}

/**
 * HTMLタグを落として1行のプレーンテキストにする。
 *
 * RSSの<description>はHTMLがエスケープされて入っているのが普通なので
 * 「デコード → タグ除去 → 再デコード」の順で処理する。
 * 先にタグ除去だけしても &lt;p&gt; が文字列として残ってしまう。
 */
export function stripHtml(input) {
  if (!input) return '';
  const decoded = decodeEntities(stripCdata(input));
  const withoutTags = decoded
    .replace(/<(script|style)[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr)\s*>/gi, ' ')
    .replace(/<[^>]*>/g, '');
  return decodeEntities(withoutTags).replace(/\s+/g, ' ').trim();
}

/** 名前空間プレフィックス付きにも当たるタグ検索（最初の1件） */
function firstTagContent(xml, names) {
  for (const name of names) {
    const re = new RegExp(
      `<(?:[\\w.-]+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w.-]+:)?${name}\\s*>`,
      'i',
    );
    const m = xml.match(re);
    if (m && m[1].trim()) return m[1];
  }
  return '';
}

/** タグの属性を { name: value } に分解する */
function parseAttrs(tagText) {
  const attrs = {};
  const re = /([\w.:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m;
  while ((m = re.exec(tagText)) !== null) {
    attrs[m[1].toLowerCase()] = decodeEntities(m[3] ?? m[4] ?? '');
  }
  return attrs;
}

/** 記事本体のURLを決める。Atomの self / edit などは除外する */
function extractLink(block) {
  // Atom: <link rel="alternate" href="..."/>
  const candidates = [];
  const re = /<(?:[\w.-]+:)?link\b([^>]*?)\/?>/gi;
  let m;
  while ((m = re.exec(block)) !== null) {
    const attrs = parseAttrs(m[1]);
    if (!attrs.href) continue;
    const rel = attrs.rel || 'alternate';
    if (rel !== 'alternate') continue;
    if (attrs.type && !/html/i.test(attrs.type)) continue;
    candidates.push(attrs.href);
  }
  if (candidates.length > 0) return candidates[0];

  // RSS: <link>https://...</link>
  const rss = firstTagContent(block, ['link']);
  if (rss) {
    const text = decodeEntities(stripCdata(rss)).trim();
    if (/^https?:\/\//i.test(text)) return text;
  }

  // 最後の手段: guid が URL 形式なら使う
  const guid = firstTagContent(block, ['guid', 'id']);
  const guidText = decodeEntities(stripCdata(guid)).trim();
  return /^https?:\/\//i.test(guidText) ? guidText : '';
}

function parseDate(raw) {
  const text = decodeEntities(stripCdata(raw || '')).trim();
  if (!text) return null;
  const ms = Date.parse(text);
  return Number.isNaN(ms) ? null : new Date(ms);
}

/**
 * フィード本文（XML文字列）を記事配列に変換する。
 * @returns {{ feedTitle: string, items: Array<{title,link,published,summary,guid}> }}
 */
export function parseFeed(xml) {
  if (typeof xml !== 'string' || xml.trim() === '') {
    return { feedTitle: '', items: [] };
  }

  // チャンネル情報とアイテムを混同しないよう、最初の item/entry より前をヘッダとみなす
  const firstItemIndex = xml.search(/<(?:[\w.-]+:)?(?:item|entry)\b/i);
  const header = firstItemIndex === -1 ? xml : xml.slice(0, firstItemIndex);
  const feedTitle = stripHtml(firstTagContent(header, ['title']));

  const blocks = xml.match(/<(?:[\w.-]+:)?(?:item|entry)\b[\s\S]*?<\/(?:[\w.-]+:)?(?:item|entry)\s*>/gi) || [];

  const items = blocks.map((block) => {
    const title = stripHtml(firstTagContent(block, ['title']));
    const link = extractLink(block);
    const published = parseDate(
      firstTagContent(block, ['pubDate', 'published', 'updated', 'date']),
    );
    const summary = stripHtml(
      firstTagContent(block, ['description', 'summary', 'encoded', 'content']),
    );
    const guid = decodeEntities(stripCdata(firstTagContent(block, ['guid', 'id']))).trim();
    return { title, link, published, summary, guid };
  });

  return { feedTitle, items: items.filter((item) => item.title && item.link) };
}
