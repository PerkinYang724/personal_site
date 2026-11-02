import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { SITE } from '../site';
import { getPosts } from '../utils';

export async function GET(context: APIContext) {
  const [writing, newsletter] = await Promise.all([getPosts('writing'), getPosts('newsletter')]);
  const items = [
    ...writing.map((p) => ({ ...p.data, pubDate: p.data.date, link: `/writing/${p.id}/` })),
    ...newsletter.map((p) => ({ ...p.data, pubDate: p.data.date, link: `/newsletter/${p.id}/` })),
  ].sort((a, b) => b.pubDate.valueOf() - a.pubDate.valueOf());

  return rss({ title: SITE.title, description: SITE.description, site: context.site!, items });
}
