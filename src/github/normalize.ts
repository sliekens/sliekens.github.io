import type {
  ActivityItem,
  CalendarDay,
  ContributionCalendar,
  LanguageStat,
  Repo,
} from './types';

/** A pocket subset of GitHub Linguist colors; anything else gets a stable hash hue. */
export const LANGUAGE_COLORS: Record<string, string> = {
  'C#': '#178600',
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  HTML: '#e34c26',
  CSS: '#663399',
  SCSS: '#c6538c',
  Python: '#3572A5',
  Go: '#00ADD8',
  Rust: '#dea584',
  Java: '#b07219',
  Kotlin: '#A97BFF',
  Swift: '#F05138',
  C: '#555555',
  'C++': '#f34b7d',
  PowerShell: '#012456',
  Shell: '#89e051',
  Ruby: '#701516',
  PHP: '#4F5D95',
  Dockerfile: '#384d54',
  Vue: '#41b883',
  Svelte: '#ff3e00',
  Dart: '#00B4AB',
  Lua: '#000080',
  Haskell: '#5e5086',
  Elixir: '#6e4a7e',
  Scala: '#c22d40',
  'F#': '#b845fc',
  'Visual Basic .NET': '#945db7',
  TSQL: '#e38c00',
  Bicep: '#519aba',
  HCL: '#844FBA',
  Nix: '#7e7eff',
  Makefile: '#427819',
  CMake: '#DA3434',
  Batchfile: '#C1F12E',
  'Jupyter Notebook': '#DA5B0B',
  Markdown: '#083fa1',
  Zig: '#ec915c',
  Astro: '#ff5a03',
  MDX: '#fcb32c',
};

export function languageColor(name: string | null | undefined): string {
  if (!name) return '#8b949e';
  const known = LANGUAGE_COLORS[name];
  if (known) return known;
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return `hsl(${Math.abs(h) % 360}, 62%, 56%)`;
}

const cap = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function firstLine(s: string | null | undefined, max = 140): string {
  if (!s) return '';
  const line = s.replace(/\r/g, '').split('\n')[0].trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

/**
 * Turn raw GitHub REST events (api.github.com/users/:user/events/public)
 * into displayable activity items. Unknown event types are dropped.
 */
export function normalizeEvents(raw: unknown): ActivityItem[] {
  if (!Array.isArray(raw)) return [];
  const items: ActivityItem[] = [];
  const seen = new Set<string>();
  for (const ev of raw) {
    const item = normalizeEvent(ev);
    if (item && !seen.has(item.id)) {
      seen.add(item.id);
      items.push(item);
    }
  }
  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return items;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function normalizeEvent(ev: any): ActivityItem | null {
  const repo: string = ev?.repo?.name ?? '';
  const p = ev?.payload ?? {};
  const id = String(ev?.id ?? '');
  const createdAt = String(ev?.created_at ?? '');
  if (!id || !createdAt) return null;
  const repoUrl = repo ? `https://github.com/${repo}` : 'https://github.com';
  const base = { id, repo, createdAt, detail: '', url: repoUrl };

  switch (ev?.type) {
    case 'PushEvent': {
      const n: number = p.size ?? p.commits?.length ?? 0;
      const url =
        p.before && p.head
          ? `${repoUrl}/compare/${String(p.before).slice(0, 12)}...${String(p.head).slice(0, 12)}`
          : repoUrl;
      return {
        ...base,
        type: 'push',
        title: `Pushed ${n} commit${n === 1 ? '' : 's'}`,
        detail: firstLine(p.commits?.[0]?.message),
        url,
      };
    }
    case 'PullRequestEvent': {
      const pr = p.pull_request;
      const verb =
        p.action === 'closed' ? (pr?.merged ? 'Merged' : 'Closed') : cap(String(p.action ?? 'Updated'));
      const num = p.number ?? pr?.number;
      return {
        ...base,
        type: 'pr',
        title: `${verb} pull request${num ? ` #${num}` : ''}`,
        detail: firstLine(pr?.title),
        url: pr?.html_url ?? base.url,
      };
    }
    case 'PullRequestReviewEvent': {
      const pr = p.pull_request;
      return {
        ...base,
        type: 'review',
        title: `Reviewed pull request${pr?.number ? ` #${pr.number}` : ''}`,
        detail: firstLine(pr?.title),
        url: p.review?.html_url ?? pr?.html_url ?? base.url,
      };
    }
    case 'IssuesEvent': {
      const issue = p.issue;
      return {
        ...base,
        type: 'issue',
        title: `${cap(String(p.action ?? 'Updated'))} issue${issue?.number ? ` #${issue.number}` : ''}`,
        detail: firstLine(issue?.title),
        url: issue?.html_url ?? base.url,
      };
    }
    case 'IssueCommentEvent': {
      const issue = p.issue;
      return {
        ...base,
        type: 'comment',
        title: `Commented on${issue?.number ? ` #${issue.number}` : ' an issue'}`,
        detail: firstLine(issue?.title ?? p.comment?.body),
        url: p.comment?.html_url ?? issue?.html_url ?? base.url,
      };
    }
    case 'CreateEvent': {
      const refType = String(p.ref_type ?? 'something');
      const ref = p.ref ? ` ${p.ref}` : '';
      return { ...base, type: 'create', title: `Created ${refType}${ref}`, url: repoUrl };
    }
    case 'DeleteEvent': {
      return {
        ...base,
        type: 'delete',
        title: `Deleted ${String(p.ref_type ?? 'ref')} ${String(p.ref ?? '')}`.trim(),
        url: repoUrl,
      };
    }
    case 'WatchEvent':
      return { ...base, type: 'star', title: 'Starred this repository', url: repoUrl };
    case 'ForkEvent':
      return {
        ...base,
        type: 'fork',
        title: `Forked to ${p.forkee?.full_name ?? 'a new repository'}`,
        url: p.forkee?.html_url ?? base.url,
      };
    case 'ReleaseEvent': {
      const rel = p.release;
      return {
        ...base,
        type: 'release',
        title: `${cap(String(p.action ?? 'Published'))} release ${rel?.tag_name ?? ''}`.trim(),
        detail: firstLine(rel?.name),
        url: rel?.html_url ?? base.url,
      };
    }
    case 'GollumEvent': {
      const pages = Array.isArray(p.pages) ? p.pages : [];
      return {
        ...base,
        type: 'wiki',
        title: `Edited ${pages.length} wiki page${pages.length === 1 ? '' : 's'}`,
        detail: firstLine(pages[0]?.title),
        url: pages[0]?.html_url ?? base.url,
      };
    }
    case 'PublicEvent':
      return { ...base, type: 'public', title: 'Made this repository public', url: repoUrl };
    default:
      return null;
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function buildEmptyWeeks(): { days: CalendarDay[] }[] {
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - end.getUTCDay() - 52 * 7);
  const weeks: { days: CalendarDay[] }[] = [];
  let week: CalendarDay[] = [];
  for (const d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    week.push({ date: d.toISOString().slice(0, 10), count: 0 });
    if (week.length === 7) {
      weeks.push({ days: week });
      week = [];
    }
  }
  if (week.length) weeks.push({ days: week });
  return weeks;
}

/** Approximate a contribution calendar by bucketing public events per day (~90 days of data). */
export function deriveCalendar(events: ActivityItem[]): ContributionCalendar {
  const counts = new Map<string, number>();
  for (const e of events) {
    const day = e.createdAt.slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  const weeks = buildEmptyWeeks();
  let total = 0;
  for (const w of weeks)
    for (const d of w.days) {
      d.count = counts.get(d.date) ?? 0;
      total += d.count;
    }
  return { total, weeks, source: events.length ? 'derived' : 'none' };
}

export function emptyCalendar(): ContributionCalendar {
  return { total: 0, weeks: buildEmptyWeeks(), source: 'none' };
}

/** Relative intensity levels (0–4) per date, using quartiles of the non-zero days. */
export function dayLevels(cal: ContributionCalendar): Map<string, number> {
  const flat = cal.weeks.flatMap((w) => w.days);
  const nonzero = flat
    .map((d) => d.count)
    .filter((c) => c > 0)
    .sort((a, b) => a - b);
  const q = (p: number): number =>
    nonzero.length ? nonzero[Math.min(nonzero.length - 1, Math.floor(p * nonzero.length))] : 1;
  const t1 = q(0.25);
  const t2 = q(0.5);
  const t3 = q(0.75);
  const map = new Map<string, number>();
  for (const d of flat) {
    map.set(d.date, d.count === 0 ? 0 : d.count <= t1 ? 1 : d.count <= t2 ? 2 : d.count <= t3 ? 3 : 4);
  }
  return map;
}

export interface CalendarSummary {
  total: number;
  bestDay: CalendarDay | null;
  longestStreak: number;
  currentStreak: number;
  activeDays: number;
}

export function summarizeCalendar(cal: ContributionCalendar): CalendarSummary {
  const flat = cal.weeks.flatMap((w) => w.days);
  let bestDay: CalendarDay | null = null;
  let longestStreak = 0;
  let run = 0;
  let activeDays = 0;
  for (const d of flat) {
    if (d.count > 0) {
      activeDays++;
      run++;
      longestStreak = Math.max(longestStreak, run);
      if (!bestDay || d.count > bestDay.count) bestDay = d;
    } else {
      run = 0;
    }
  }
  let currentStreak = 0;
  let i = flat.length - 1;
  if (i >= 0 && flat[i].count === 0) i--; // today may not have contributions yet
  for (; i >= 0 && flat[i].count > 0; i--) currentStreak++;
  return { total: cal.total, bestDay, longestStreak, currentStreak, activeDays };
}

export function aggregateLanguages(repos: Repo[]): LanguageStat[] {
  const m = new Map<string, { color: string; repoCount: number }>();
  for (const r of repos) {
    if (r.isFork || !r.language) continue;
    const entry = m.get(r.language) ?? {
      color: r.languageColor || languageColor(r.language),
      repoCount: 0,
    };
    entry.repoCount++;
    m.set(r.language, entry);
  }
  return [...m.entries()]
    .map(([name, v]) => ({ name, color: v.color, repoCount: v.repoCount }))
    .sort((a, b) => b.repoCount - a.repoCount)
    .slice(0, 10);
}

export function fmt(n: number): string {
  if (n >= 10000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

const rtf = typeof Intl !== 'undefined' ? new Intl.RelativeTimeFormat('en', { numeric: 'auto' }) : null;

export function relTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const s = Math.round((t - Date.now()) / 1000);
  const abs = Math.abs(s);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [unit, size] of units) {
    if (abs >= size) return rtf ? rtf.format(Math.round(s / size), unit) : iso.slice(0, 10);
  }
  return 'just now';
}
