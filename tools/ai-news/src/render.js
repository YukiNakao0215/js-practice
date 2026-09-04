import { formatDateTime, formatTime } from './time.js';

/** Markdownのリンクテキストを壊す文字を退避する */
function escapeLinkText(text) {
  return text.replace(/([[\]])/g, '\\$1');
}

/** YAMLの値として安全な形にする */
function yamlString(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function countByName(articles, key) {
  const counts = new Map();
  for (const article of articles) {
    for (const term of article[key]) {
      counts.set(term.name, { term, count: (counts.get(term.name)?.count || 0) + 1 });
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.term.name.localeCompare(b.term.name));
}

function shiftDate(dateString, days) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function renderArticle(article, config) {
  const lines = [];
  const when = article.published
    ? formatTime(article.published, config.timezone)
    : '時刻不明';
  lines.push(`- **[${escapeLinkText(article.title)}](${article.url})**`);
  lines.push(`  ${article.source} · ${when}`);
  if (article.summary) lines.push(`  ${article.summary}`);

  const refs = [
    ...article.entities.map((entity) => `[[${entity.name}]]`),
    ...article.topics.map((topic) => `#${topic.tag}`),
  ];
  if (refs.length > 0) lines.push(`  ${refs.join(' ')}`);
  return lines.join('\n');
}

/**
 * 日次ノートのMarkdown全文を生成する。
 * @param {{ articles: Array, stats: object, errors: Array, dateString: string, now: Date }} input
 */
export function renderNote({ articles, stats, errors, dateString, now }, config) {
  const entityCounts = countByName(articles, 'entities');
  const topicCounts = countByName(articles, 'topics');

  const tags = [
    'ai-news',
    ...entityCounts.map(({ term }) => term.tag),
    ...topicCounts.map(({ term }) => term.tag),
  ].filter(Boolean);

  const frontmatter = [
    '---',
    `title: ${yamlString(`AIニュース ${dateString}`)}`,
    `date: ${dateString}`,
    'type: ai-news-daily',
    'tags:',
    ...[...new Set(tags)].map((tag) => `  - ${tag}`),
    `articles: ${articles.length}`,
    `feeds_ok: ${config.feeds.length - errors.length}`,
    `feeds_failed: ${errors.length}`,
    `generated: ${yamlString(formatDateTime(now, config.timezone))}`,
    '---',
  ];

  const body = [`# AIニュース ${dateString}`, ''];

  if (articles.length === 0) {
    body.push('> [!warning] 新着記事なし', '> 対象期間内に新しい記事が見つかりませんでした。', '');
  } else {
    if (entityCounts.length > 0 || topicCounts.length > 0) {
      body.push('## 注目');
      if (entityCounts.length > 0) {
        body.push(`- **企業・製品**: ${entityCounts.slice(0, 8).map(({ term, count }) => `[[${term.name}]] (${count})`).join(' · ')}`);
      }
      if (topicCounts.length > 0) {
        body.push(`- **テーマ**: ${topicCounts.slice(0, 8).map(({ term, count }) => `#${term.tag} (${count})`).join(' ')}`);
      }
      body.push('');
    }

    // 設定の feeds に書かれた順でカテゴリを並べる（公式ブログ → 英語メディア → 日本語メディア）
    const categoryOrder = [...new Set(config.feeds.map((feed) => feed.category || 'その他'))];
    const grouped = new Map(categoryOrder.map((category) => [category, []]));
    for (const article of articles) {
      if (!grouped.has(article.category)) grouped.set(article.category, []);
      grouped.get(article.category).push(article);
    }

    for (const [category, group] of grouped) {
      if (group.length === 0) continue;
      body.push(`## ${category} (${group.length})`, '');
      for (const article of group) body.push(renderArticle(article, config), '');
    }
  }

  if (errors.length > 0) {
    body.push('## 取得エラー', '');
    body.push('> [!caution] 以下のフィードは取得できませんでした。URLの変更やサイト側の障害を疑ってください。');
    for (const { feed, error } of errors) body.push(`> - **${feed.name}** (${feed.url}) — ${error}`);
    body.push('');
  }

  body.push('---', '');
  body.push(
    `*取得 ${stats.fetched} 件 / 掲載 ${articles.length} 件 ` +
    `(既出 ${stats.alreadySeen} · 重複 ${stats.duplicate} · 期間外 ${stats.outOfWindow} · 除外 ${stats.excluded})*`,
  );
  if (config.linkPrevDay) {
    const prevBase = config.notePath.split(/[\\/]/).pop().replace(/\.md$/, '')
      .replace('{{date}}', shiftDate(dateString, -1));
    body.push('', `前日: [[${prevBase}]]`);
  }

  return `${[...frontmatter, '', ...body].join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
}
