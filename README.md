# personal-site

Writing, newsletter, and projects in one place. Built with [Astro](https://astro.build).

- `npm run dev` — local preview at http://localhost:4321
- `npm run build` — static site in `dist/`

## Adding content
| What | Where |
|---|---|
| Name, bio, links, newsletter signup URL | `src/site.ts` |
| About page | `src/pages/about.astro` |
| Blog posts / essays | `src/content/writing/*.md` |
| Newsletter issues | `src/content/newsletter/*.md` |
| Projects | `src/content/projects/*.md` |

Set `draft: true` in a post's frontmatter to hide it from the built site.
