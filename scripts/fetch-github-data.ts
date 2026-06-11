/**
 * Build-time GitHub data fetcher.
 *
 * Runs in GitHub Actions (with the workflow's GITHUB_TOKEN) or locally
 * (optionally with `gh auth token`). Produces public/data/github.json,
 * which the static site loads at runtime.
 *
 * Without a token it still works against the public REST API, but the
 * contribution calendar (GraphQL-only) falls back to an approximation
 * derived from public events.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { GITHUB_USER } from '../src/config';
import {
  aggregateLanguages,
  deriveCalendar,
  emptyCalendar,
  languageColor,
  normalizeEvents,
} from '../src/github/normalize';
import type { ContributionCalendar, GithubData, Profile, Repo } from '../src/github/types';

const USER = process.env.MUSEUM_GITHUB_USER ?? GITHUB_USER;
const TOKEN = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? '';
const OUT = path.resolve('public/data/github.json');
const API = 'https://api.github.com';

function headers(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': `${USER}-github-museum`,
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (TOKEN) h.Authorization = `Bearer ${TOKEN}`;
  return h;
}

async function rest<T>(p: string): Promise<T> {
  const res = await fetch(`${API}${p}`, { headers: headers() });
  if (!res.ok) throw new Error(`GET ${p} -> HTTP ${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

async function graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API}/graphql`, {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`GraphQL -> HTTP ${res.status}`);
  const body = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (body.errors?.length) throw new Error(`GraphQL: ${body.errors.map((e) => e.message).join('; ')}`);
  if (!body.data) throw new Error('GraphQL: empty response');
  return body.data;
}

/** Full Linguist color map, courtesy of the ozh/github-colors mirror. */
async function fetchLinguistColors(): Promise<Record<string, { color: string | null }>> {
  try {
    const res = await fetch('https://raw.githubusercontent.com/ozh/github-colors/master/colors.json');
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as Record<string, { color: string | null }>;
  } catch {
    console.warn('! Linguist colors unavailable; falling back to built-in palette');
    return {};
  }
}

const GRAPHQL_QUERY = /* GraphQL */ `
  query Museum($login: String!) {
    user(login: $login) {
      pinnedItems(first: 6, types: [REPOSITORY]) {
        nodes {
          ... on Repository {
            name
          }
        }
      }
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              contributionCount
            }
          }
        }
      }
    }
  }
`;

interface GraphQLResult {
  user: {
    pinnedItems: { nodes: ({ name?: string } | null)[] };
    contributionsCollection: {
      contributionCalendar: {
        totalContributions: number;
        weeks: { contributionDays: { date: string; contributionCount: number }[] }[];
      };
    };
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function main(): Promise<void> {
  console.log(`Fetching GitHub data for "${USER}" ${TOKEN ? '(authenticated)' : '(unauthenticated)'}`);

  const [profileRaw, reposRaw, colors] = await Promise.all([
    rest<any>(`/users/${USER}`),
    rest<any[]>(`/users/${USER}/repos?per_page=100&sort=pushed`),
    fetchLinguistColors(),
  ]);

  const rawEvents: any[] = [];
  for (let page = 1; page <= 3; page++) {
    const batch = await rest<any[]>(`/users/${USER}/events/public?per_page=100&page=${page}`);
    rawEvents.push(...batch);
    if (batch.length < 100) break;
  }
  const events = normalizeEvents(rawEvents).slice(0, 90);

  let pinned: string[] = [];
  let calendar: ContributionCalendar | null = null;
  if (TOKEN) {
    try {
      const gq = await graphql<GraphQLResult>(GRAPHQL_QUERY, { login: USER });
      pinned = gq.user.pinnedItems.nodes
        .map((n) => n?.name)
        .filter((n): n is string => typeof n === 'string');
      const cal = gq.user.contributionsCollection.contributionCalendar;
      calendar = {
        total: cal.totalContributions,
        weeks: cal.weeks.map((w) => ({
          days: w.contributionDays.map((d) => ({ date: d.date, count: d.contributionCount })),
        })),
        source: 'graphql',
      };
    } catch (err) {
      console.warn(`! GraphQL query failed: ${err instanceof Error ? err.message : err}`);
    }
  } else {
    console.warn('! No token: skipping pinned repos and contribution calendar (GraphQL)');
  }
  if (!calendar) calendar = events.length ? deriveCalendar(events) : emptyCalendar();

  const repos: Repo[] = reposRaw.map((r) => ({
    name: r.name,
    description: r.description ?? '',
    htmlUrl: r.html_url,
    homepage: r.homepage ?? '',
    stars: r.stargazers_count ?? 0,
    forks: r.forks_count ?? 0,
    language: r.language ?? '',
    languageColor: r.language ? (colors[r.language]?.color ?? languageColor(r.language)) : '',
    topics: Array.isArray(r.topics) ? r.topics : [],
    pushedAt: r.pushed_at ?? r.updated_at ?? '',
    createdAt: r.created_at ?? '',
    hasPages: Boolean(r.has_pages),
    archived: Boolean(r.archived),
    isFork: Boolean(r.fork),
    openIssues: r.open_issues_count ?? 0,
    pinned: pinned.includes(r.name),
  }));
  repos.sort((a, b) => {
    const pa = pinned.indexOf(a.name);
    const pb = pinned.indexOf(b.name);
    const ra = pa === -1 ? Number.MAX_SAFE_INTEGER : pa;
    const rb = pb === -1 ? Number.MAX_SAFE_INTEGER : pb;
    if (ra !== rb) return ra - rb;
    if (b.stars !== a.stars) return b.stars - a.stars;
    return b.pushedAt.localeCompare(a.pushedAt);
  });

  const profile: Profile = {
    login: profileRaw.login,
    name: profileRaw.name ?? profileRaw.login,
    avatarUrl: profileRaw.avatar_url ?? '',
    bio: profileRaw.bio ?? '',
    company: profileRaw.company ?? '',
    location: profileRaw.location ?? '',
    blog: profileRaw.blog ?? '',
    htmlUrl: profileRaw.html_url ?? `https://github.com/${USER}`,
    followers: profileRaw.followers ?? 0,
    following: profileRaw.following ?? 0,
    publicRepos: profileRaw.public_repos ?? 0,
    createdAt: profileRaw.created_at ?? '',
  };

  const data: GithubData = {
    generatedAt: new Date().toISOString(),
    profile,
    repos,
    totalStars: repos.reduce((sum, r) => sum + r.stars, 0),
    events,
    calendar,
    languages: aggregateLanguages(repos),
  };

  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, `${JSON.stringify(data, null, 2)}\n`);
  console.log(
    `✓ Wrote ${path.relative(process.cwd(), OUT)}: ${repos.length} repos, ${events.length} events, ` +
      `calendar=${calendar.source} (${calendar.total} contributions), ${pinned.length} pinned`
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

main().catch(async (err) => {
  console.error(`✗ Fetch failed: ${err instanceof Error ? err.message : err}`);
  try {
    await readFile(OUT);
    console.warn('Keeping the previously generated github.json so the build can proceed.');
    process.exit(0);
  } catch {
    process.exit(1);
  }
});
