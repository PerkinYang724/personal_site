import { getCollection } from 'astro:content';

export const formatDate = (d: Date) =>
  d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });

// Drafts show up in `npm run dev` but are hidden from the built site.
const visible = ({ data }: { data: { draft?: boolean } }) => import.meta.env.DEV || !data.draft;

export async function getPosts(name: 'writing' | 'newsletter') {
  const entries = await getCollection(name, visible);
  return entries.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export async function getProjects() {
  const entries = await getCollection('projects');
  return entries.sort(
    (a, b) => Number(b.data.featured) - Number(a.data.featured) || b.data.date.valueOf() - a.data.date.valueOf(),
  );
}
