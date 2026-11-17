import { SITE } from './site';

export interface SubstackPost {
  title: string;
  url: string;
  date: Date;
  summary: string;
  image?: string;
  minutes?: number;
  // Pulled from the post body: the opening line(s), the first few story headlines, and how many stories there are.
  lead: string[];
  // One short line that sells the post: the English opening line if there is one, otherwise the first.
  hook: string;
  headlines: string[];
  stories: number;
}

// The feed is read when the site builds. In `npm run dev` it is re-read at most once every 10 minutes.
const TTL = 10 * 60 * 1000;
let cache: { at: number; posts: SubstackPost[] } | undefined;

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s: string) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);

const tag = (xml: string, name: string) => {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
  if (!m) return '';
  const cdata = m[1].match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  return cdata ? cdata[1].trim() : decode(m[1].trim());
};

const text = (html: string) => decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

const clip = (s: string, max = 170) => {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 30)).replace(/[\s.,;:!?-]+$/, '')}…`;
};

export function parseFeed(xml: string): SubstackPost[] {
  return xml
    .split(/<item[\s>]/)
    .slice(1)
    .map((raw) => {
      const item = raw.split('</item>')[0];
      const html = tag(item, 'content:encoded');
      const body = text(html);
      // Latin words at ~230 a minute, Chinese/Japanese/Korean characters at ~400 a minute.
      const cjk = body.match(/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/g)?.length ?? 0;
      const latin = body.match(/[A-Za-z0-9][A-Za-z0-9'’-]*/g)?.length ?? 0;
      const stated = Number(body.slice(0, 400).match(/(\d+)\s*min(?:ute)?s?\s+read/i)?.[1]);
      const intro = html.split(/<h[1-6][\s>]/)[0];
      const lead = [...intro.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)]
        .map((m) => text(m[1]))
        .filter((t) => t.length > 12 && t.length < 220 && !/min(?:ute)?s?\s+read/i.test(t))
        .slice(0, 2);
      const h3 = [...html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/g)].map((m) => text(m[1])).filter(Boolean);
      const image = item.match(/<enclosure[^>]*\burl="([^"]+)"[^>]*\btype="image\//)?.[1];
      return {
        title: text(tag(item, 'title')),
        url: tag(item, 'link'),
        date: new Date(tag(item, 'pubDate')),
        summary: clip(text(tag(item, 'description')) || body),
        image: image ? decode(image) : undefined,
        minutes: stated || (cjk + latin ? Math.max(1, Math.round(latin / 230 + cjk / 400)) : undefined),
        lead,
        hook: lead.find((l) => !/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(l)) ?? lead[0] ?? clip(text(tag(item, 'description')), 110),
        headlines: h3.slice(0, 3),
        stories: h3.length,
      };
    })
    .filter((p) => p.title && p.url && !Number.isNaN(p.date.valueOf()))
    .sort((a, b) => b.date.valueOf() - a.date.valueOf());
}

export const substackUrl = () => SITE.substack.url.trim().replace(/\/+$/, '');

// Never throws: if Substack is unreachable the section is simply left out, so a build cannot fail because of it.
export async function getSubstackPosts(limit = 5): Promise<SubstackPost[]> {
  const base = substackUrl();
  if (!base) return [];
  if (cache && Date.now() - cache.at < TTL) return cache.posts.slice(0, limit);
  try {
    const res = await fetch(`${base}/feed`, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; site-build feed reader)', accept: 'application/rss+xml, application/xml' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cache = { at: Date.now(), posts: parseFeed(await res.text()) };
  } catch (err) {
    console.warn(`[substack] Could not read ${base}/feed: ${(err as Error).message}`);
    if (!cache) return [];
  }
  return cache.posts.slice(0, limit);
}

// Total number of posts ever published, counted from the Substack sitemap. 0 if it cannot be read.
let total: { at: number; n: number } | undefined;
export async function getSubstackCount(): Promise<number> {
  const base = substackUrl();
  if (!base) return 0;
  if (total && Date.now() - total.at < TTL) return total.n;
  try {
    const res = await fetch(`${base}/sitemap.xml`, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; site-build feed reader)' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    total = { at: Date.now(), n: (await res.text()).match(/<loc>[^<]*\/p\/[^<]*<\/loc>/g)?.length ?? 0 };
  } catch (err) {
    console.warn(`[substack] Could not read ${base}/sitemap.xml: ${(err as Error).message}`);
    if (!total) return 0;
  }
  return total.n;
}
