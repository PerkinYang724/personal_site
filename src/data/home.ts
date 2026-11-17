// Every word on the home page lives here. All of it is placeholder copy — replace it whenever you're ready.
// To change a photo, overwrite the matching file in public/images/ (same filename, no code changes).
export const HOME = {
  hero: {
    // Encoded with -movflags +faststart and no hidden frames before 0:00: the image fallback in home.ts would show them.
    video: '/videos/hero-section.mp4',
    poster: '/videos/hero-poster.jpg',
    status: 'Student, builder, host of Still Human',
    lineOne: 'Two years of building fast',
    lineTwo: { dim: 'taught me to', bright: 'slow down and write' },
    taxonomy: [
      { label: 'Writing', href: '/writing/' },
      { label: 'Newsletter', href: '/newsletter/' },
      { label: 'Projects', href: '/projects/' },
      { label: 'About', href: '/about/' },
    ],
    // The little boxes that fly out of the logo. x/y are where each one settles, as a percentage of the hero.
    // `corner` is the corner of the box its square sits on. `tether: false` leaves out the line back to the logo.
    trackers: [
      { label: 'Still Human', x: 74.5, y: 25.5, corner: 'bl' },
      { label: 'Chiayi to Santa Clara', x: 37.2, y: 35.8, corner: 'bl' },
      { label: 'MIS at Santa Clara', x: 80.4, y: 47.7, corner: 'bl' },
      { label: 'Now', x: 12.5, y: 61.6, corner: 'tr' },
      { label: 'Building with AI daily', x: 79.5, y: 75.8, corner: 'bl', tether: false },
    ],
  },
  manifesto: {
    label: 'Why I Write',
    tag: 'Chiayi to Santa Clara',
    body: 'I grew up in Chiayi, Taiwan. I now study MIS at Santa Clara and build with AI most days. I started writing because I kept having thoughts I had no one to say them to. Writing made me slow down. Two years of vibe coding taught me how fast a tool can make things. It also taught me how easy it is to ship something with no point. So I write to find the point. I think the best ideas show up after the third draft, not the first.',
    caption: 'Student, builder, host of Still Human. Currently figuring it out in public.',
    portraitLabel: 'Perkin, Santa Clara, 2026',
  },
  work: {
    kicker: 'Everything I have shipped, ticker style',
    ticker: '$PERKIN',
    // Decorative. The ticker is a visual metaphor, not a real metric — it animates and jitters on scroll.
    price: 186.42,
    priceLabel: 'Things built index',
    change: 'Since 2024',
    heading: 'Projects & Experiments',
    live: 'Live / all time',
    location: {
      name: 'Santa Clara, California',
      coords: '37.3541° N / 121.9552° W',
      note: 'By way of Chiayi, Taiwan',
    },
    layers: ['Writing', 'Projects', 'Newsletter', 'Still Human'],
  },
  words: {
    forecast: 'This year I expect',
    // Decorative, like the ticker above.
    number: 1.84,
    forecastTags: ['Third draft', 'Next essay', 'Top theme / AI and attention'],
    charts: [
      { label: 'Essays', meta: '12 mo' },
      { label: 'Drafts', meta: '12 mo' },
      { label: 'Projects', meta: '12 mo' },
      { label: 'Episodes', meta: '12 mo' },
    ],
    serif: 'From first draft to final post',
    tag: 'The writing',
    headline: 'The point shows up on draft three.',
    aside: 'Mostly about building with AI, and what it costs to think slowly while the tools get faster. Some of it is about leaving Chiayi. Some of it is just me working something out.',
    code: `// still-human.notes
import { attention } from "./me"

export function write(thought) {
  const fast = draft(thought)    // two minutes
  const real = rewrite(fast, 3)  // two weeks
  return real
}

// the tool got faster
// the thinking did not`,
  },
  tape: {
    barLeft: 'What I am doing now',
    barRight: 'Santa Clara / Updated weekly',
    ghost: ['Every project', 'has a reason'],
    symbols: ['ESSAYS', 'DRAFTS', 'PROJECTS', 'NOTES', 'PROMPTS', 'EPISODES', 'BOOKS', 'IDEAS', 'SHIPPED', 'SCRAPPED', 'COFFEE', 'WALKS', 'CHIAYI', 'SANTA CLARA', 'COMMITS', 'PAGES', 'READERS', 'REPLIES', 'DEMOS', 'QUESTIONS'],
  },
  timeline: {
    discover: 'Discover',
    // One chapter per photo: public/images/chapter-1.jpg … chapter-6.jpg
    // The `year` chips below are my best guess from what you told me — correct them to your real dates.
    chapters: [
      { year: 'Chiayi', tags: 'Taiwan / where it starts', title: 'Chiayi', text: 'I grew up in Chiayi, Taiwan. Most of what I notice now, I learned to notice there.', chip: '+1 Milestone', chipMeta: 'What changed / 01' },
      { year: 'Santa Clara', tags: 'California / the move', title: 'The Move', text: 'Then Santa Clara, and MIS. A new place is the fastest way to find out what you actually think.', chip: '+1 Milestone', chipMeta: 'What changed / 02' },
      { year: '2024', tags: 'Building / the fast years', title: 'Two Years of Vibe Coding', text: 'I learned how fast a tool can make things. For a while that felt like the whole skill.', chip: '+1 Milestone', chipMeta: 'What changed / 03' },
      { year: '2025', tags: 'Building / the lesson', title: 'Shipping With No Point', text: 'I also learned how easy it is to finish something nobody needed, including me. That one took longer to admit.', chip: '+1 Milestone', chipMeta: 'What changed / 04' },
      { year: '2025', tags: 'Talking / the podcast', title: 'Still Human', text: 'I started hosting Still Human, because the questions I cared about were not the ones about the tools.', chip: '+1 Milestone', chipMeta: 'What changed / 05' },
      { year: '2026', tags: 'Writing / right now', title: 'Writing to Find the Point', text: 'Now I write to find the point before I build. Still studying, still building with AI, still figuring it out in public.', chip: '+1 Milestone', chipMeta: 'What changed / 06' },
    ],
  },
  dispatch: {
    posterKicker: 'Latest brief',
    posterFallback: 'Daily',
    posterFoot: ['Writing', 'Building', 'Still Human'],
    posterRead: 'Read on Substack',
    heading: ['Notes from someone', 'figuring it out in public'],
    tag: 'Newsletter',
  },
  closing: {
    listHeading: 'Ideas Detected',
    start: 'Start here',
    serif: 'Thousands of ideas a year',
    headline: 'A few of them matter.',
    secondary: 'Get in touch',
    primary: 'Read the writing',
    signals: [
      ['IDEA', 'Opened a new note'],
      ['DRAFT', 'Rewriting draft two'],
      ['BUILD', 'Shipped something small'],
      ['SCRAP', 'Killed a pointless feature'],
      ['EPISODE', 'Still Human, recording'],
      ['READ', 'Halfway through a book'],
    ],
    popups: ['Idea', 'Draft', 'Build', 'Episode'],
  },
};
