# personal-site

Writing, newsletter, and projects in one place. Built with [Astro](https://astro.build).

- `npm run dev` — local preview at http://localhost:4321
- `npm run build` — static site in `dist/`

## Adding content
| What | Where |
|---|---|
| Name, email, social links, newsletter signup URL | `src/site.ts` |
| All home page words | `src/data/home.ts` |
| Home page and timeline photos | `public/images/` (overwrite a file, keep its name) |
| About page | `src/pages/about.astro` |
| Essays | `src/content/writing/*.md` |
| Newsletter issues | `src/content/newsletter/*.md` |
| Projects | `src/content/projects/*.md` |

Set `draft: true` in an essay or issue to hide it from the built site.

## Code map
- `src/components/home/` holds the markup for each home page section.
- `src/scripts/home.ts` holds all home page animation, one function per section.
- `src/styles/home.css` styles the home page; `src/styles/global.css` styles everything else.
- `scripts/gen-assets.mjs` regenerates the placeholder images and globe dots. Running it overwrites `public/images/`, so don't run it after adding your own photos.
