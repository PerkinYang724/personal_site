import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const post = z.object({
  title: z.string(),
  // Chinese title. Setting it marks the post as bilingual (see “Bilingual posts” in global.css).
  titleZh: z.string().optional(),
  description: z.string().optional(),
  date: z.coerce.date(),
  tags: z.array(z.string()).default([]),
  draft: z.boolean().default(false),
});

const writing = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/writing' }),
  schema: post,
});

const newsletter = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/newsletter' }),
  schema: post.extend({ issue: z.number().optional() }),
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    symbol: z.string().optional(),
    category: z.string().default('Other'),
    description: z.string(),
    date: z.coerce.date(),
    status: z.enum(['active', 'shipped', 'paused', 'archived']).default('shipped'),
    tags: z.array(z.string()).default([]),
    url: z.string().url().optional(),
    repo: z.string().url().optional(),
    featured: z.boolean().default(false),
    // Optional list of YouTube videos, shown as a feed on the project page.
    videos: z
      .array(
        z.object({
          id: z.string(),
          title: z.string(),
          summary: z.string().optional(),
          date: z.coerce.date().optional(),
          duration: z.string().optional(),
          start: z.number().optional(),
        }),
      )
      .default([]),
    videosHeading: z.string().default('Videos'),
  }),
});

export const collections = { writing, newsletter, projects };
