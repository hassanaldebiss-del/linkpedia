const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Simple XML parser for RSS
function parseRSS(xml) {
  const items = [];
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const get = (tag) => {
      const m = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i'));
      return m ? (m[1] || m[2] || '').trim() : '';
    };
    const title = get('title');
    const url = get('link') || get('guid');
    const summary = get('description').replace(/<[^>]+>/g, '').slice(0, 300);
    const pubDate = get('pubDate') || get('dc:date') || new Date().toISOString();
    if (title && url) {
      items.push({ title, url, summary, pubDate });
    }
  }
  return items;
}

function isHot(title) {
  const hotWords = ['breaking', 'urgent', 'just in', 'exclusive', 'shock', 'crisis',
    'crash', 'surge', 'soars', 'plunges', 'record', 'historic', 'dies', 'killed',
    'major', 'massive', 'emergency', 'warning', 'ban', 'arrest'];
  const lower = title.toLowerCase();
  return hotWords.some(w => lower.includes(w));
}

module.exports = async (req, res) => {
  // Protect cron endpoint
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get active sources from DB
    const { data: sources, error: srcErr } = await supabase
      .from('rss_sources')
      .select('*')
      .eq('active', true);

    if (srcErr) throw srcErr;

    let totalInserted = 0;

    for (const source of sources) {
      try {
        const response = await fetch(source.url, {
          headers: { 'User-Agent': 'Linkpedia RSS Bot/1.0' },
          signal: AbortSignal.timeout(8000)
        });
        if (!response.ok) continue;

        const xml = await response.text();
        const items = parseRSS(xml).slice(0, 15);

        for (const item of items) {
          const { error } = await supabase.from('articles').upsert({
            title: item.title.slice(0, 300),
            url: item.url,
            source: source.name,
            category: source.category,
            flag: source.flag,
            tag: source.category,
            summary: item.summary,
            is_hot: isHot(item.title),
            published_at: new Date(item.pubDate).toISOString(),
          }, { onConflict: 'url', ignoreDuplicates: true });

          if (!error) totalInserted++;
        }
      } catch (sourceErr) {
        console.error(`Failed ${source.name}:`, sourceErr.message);
      }
    }

    // Clean up articles older than 7 days
    await supabase.rpc('cleanup_old_articles');

    return res.status(200).json({
      success: true,
      sources: sources.length,
      inserted: totalInserted,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('Fetch error:', err);
    return res.status(500).json({ error: err.message });
  }
};
