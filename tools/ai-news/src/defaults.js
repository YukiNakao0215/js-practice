/**
 * 既定設定。ユーザーの config ファイルで上書き・追加できる。
 *
 * feeds は「公式ブログ（一次情報）」を軸に、日本語メディアで解説を補完する構成。
 * URLは変わることがあるので `ai-news check` で定期的に検証すること。
 */
export const DEFAULT_CONFIG = {
  // 出力先。Obsidian vault のルート（絶対パス）。必ず設定が必要。
  vaultPath: '',
  // vault 内の出力パス。{{date}} は YYYY-MM-DD に置換される。
  // Obsidian標準のデイリーノート（2026-09-04.md）と名前衝突しないよう接頭辞を付けている
  notePath: 'AI News/AI-News-{{date}}.md',
  // 日付とタイムスタンプの基準タイムゾーン
  timezone: 'Asia/Tokyo',
  // 何時間前までの記事を対象にするか（日次実行なら36前後が安全）
  windowHours: 36,
  // 1フィードあたりの最大採用件数（特定メディアで埋め尽くされるのを防ぐ）
  maxItemsPerFeed: 8,
  // ノート全体の最大件数
  maxItemsTotal: 40,
  // 各フィードのHTTPタイムアウト(ms)
  requestTimeoutMs: 15000,
  // 同時取得数
  concurrency: 5,
  // 既出記事を記録するファイル。相対パスなら設定ファイルからの相対。
  statePath: '.ai-news-state.json',
  // 状態ファイルに保持する日数
  stateRetentionDays: 45,
  // タイトル/概要にこの語を含む記事を除外（小文字比較）
  excludeKeywords: [],
  // 概要文の最大文字数
  summaryMaxChars: 220,
  // ノート末尾に前日ノートへのリンクを置く
  linkPrevDay: true,

  feeds: [
    // --- 公式ブログ（一次情報） ---
    { name: 'OpenAI', url: 'https://openai.com/news/rss.xml', category: '公式ブログ', lang: 'en' },
    { name: 'Google DeepMind', url: 'https://deepmind.google/blog/rss.xml', category: '公式ブログ', lang: 'en' },
    { name: 'Google AI Blog', url: 'https://blog.google/technology/ai/rss/', category: '公式ブログ', lang: 'en' },
    { name: 'Hugging Face', url: 'https://huggingface.co/blog/feed.xml', category: '公式ブログ', lang: 'en' },
    { name: 'AWS Machine Learning', url: 'https://aws.amazon.com/blogs/machine-learning/feed/', category: '公式ブログ', lang: 'en' },

    // --- 英語メディア ---
    { name: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', category: '英語メディア', lang: 'en' },
    { name: 'VentureBeat AI', url: 'https://venturebeat.com/category/ai/feed/', category: '英語メディア', lang: 'en' },
    { name: 'Ars Technica AI', url: 'https://arstechnica.com/ai/feed/', category: '英語メディア', lang: 'en' },
    { name: 'The Verge AI', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', category: '英語メディア', lang: 'en' },
    { name: 'Simon Willison', url: 'https://simonwillison.net/atom/everything/', category: '英語メディア', lang: 'en' },

    // --- 日本語メディア ---
    { name: 'ITmedia AI+', url: 'https://rss.itmedia.co.jp/rss/2.0/aiplus.xml', category: '日本語メディア', lang: 'ja' },
    { name: 'Publickey', url: 'https://www.publickey1.jp/atom.xml', category: '日本語メディア', lang: 'ja' },
    { name: 'はてブ AI（人気）', url: 'https://b.hatena.ne.jp/q/AI?mode=rss&users=50&sort=recent', category: '日本語メディア', lang: 'ja' },
  ],

  // 固有名詞。ヒットすると [[wikilink]] とタグを付与する（Obsidianのグラフを育てる本体）
  entities: [
    { name: 'OpenAI', tag: 'ai/openai', aliases: ['OpenAI', 'ChatGPT', 'GPT-4', 'GPT-5', 'Sora', 'DALL-E', 'DALL·E'] },
    { name: 'Anthropic', tag: 'ai/anthropic', aliases: ['Anthropic', 'Claude'] },
    { name: 'Google DeepMind', tag: 'ai/google', aliases: ['DeepMind', 'Gemini', 'Gemma', 'Google AI', 'Vertex AI'] },
    { name: 'Meta AI', tag: 'ai/meta', aliases: ['Meta AI', 'Llama', 'LLaMA'] },
    { name: 'Microsoft', tag: 'ai/microsoft', aliases: ['Microsoft', 'Copilot', 'Azure AI', 'Azure OpenAI'] },
    { name: 'NVIDIA', tag: 'ai/nvidia', aliases: ['NVIDIA', 'Nvidia', 'CUDA', 'Blackwell'] },
    { name: 'Amazon', tag: 'ai/amazon', aliases: ['Amazon Bedrock', 'AWS', 'Bedrock', 'Trainium'] },
    { name: 'Apple', tag: 'ai/apple', aliases: ['Apple Intelligence'] },
    { name: 'Mistral AI', tag: 'ai/mistral', aliases: ['Mistral AI', 'Mistral'] },
    { name: 'xAI', tag: 'ai/xai', aliases: ['xAI', 'Grok'] },
    { name: 'Hugging Face', tag: 'ai/huggingface', aliases: ['Hugging Face', 'HuggingFace'] },
    { name: 'Stability AI', tag: 'ai/stability', aliases: ['Stability AI', 'Stable Diffusion'] },
    { name: 'Cohere', tag: 'ai/cohere', aliases: ['Cohere'] },
    { name: 'DeepSeek', tag: 'ai/deepseek', aliases: ['DeepSeek'] },
    { name: 'Alibaba', tag: 'ai/alibaba', aliases: ['Qwen', 'Alibaba Cloud'] },
    { name: 'Perplexity', tag: 'ai/perplexity', aliases: ['Perplexity'] },
    { name: 'Cursor', tag: 'ai/cursor', aliases: ['Cursor'] },
    { name: 'Cloudflare', tag: 'ai/cloudflare', aliases: ['Cloudflare'] },
  ],

  // トピック。タグのみ付与する（固有名詞ではないので wikilink にはしない）
  topics: [
    { name: 'AIエージェント', tag: 'ai/agent', aliases: ['AI agent', 'AIエージェント', 'agentic', 'エージェント'] },
    { name: '規制・政策', tag: 'ai/policy', aliases: ['AI Act', 'regulation', 'regulator', '規制', '法案', 'ガイドライン'] },
    { name: '資金調達・買収', tag: 'ai/business', aliases: ['funding', 'raises', 'acquisition', 'acquires', 'IPO', '資金調達', '買収'] },
    { name: '半導体・インフラ', tag: 'ai/infra', aliases: ['GPU', 'data center', 'chip', 'semiconductor', 'データセンター', '半導体'] },
    { name: '研究・論文', tag: 'ai/research', aliases: ['arXiv', 'benchmark', 'paper', 'research', '論文', 'ベンチマーク'] },
    { name: 'オープンソース', tag: 'ai/oss', aliases: ['open source', 'open-source', 'open weights', 'オープンソース'] },
    { name: 'セキュリティ', tag: 'ai/security', aliases: ['prompt injection', 'jailbreak', 'vulnerability', '脆弱性', 'セキュリティ'] },
    { name: 'ロボティクス', tag: 'ai/robotics', aliases: ['humanoid', 'robotics', 'robot', 'ヒューマノイド', 'ロボット'] },
  ],
};
