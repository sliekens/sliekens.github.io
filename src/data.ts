import { DATA_URL, GITHUB_USER } from './config';
import { normalizeEvents } from './github/normalize';
import type { ActivityItem, GithubData } from './github/types';

/**
 * Loads the build-time snapshot, then opportunistically freshens the recent
 * activity from the public (unauthenticated) GitHub API. Any failure of the
 * freshness layer is silently ignored — the static snapshot always wins.
 */
export async function loadGithubData(): Promise<GithubData> {
  const res = await fetch(DATA_URL, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Failed to load ${DATA_URL}: HTTP ${res.status}`);
  const data = (await res.json()) as GithubData;

  try {
    const fresh = await fetchRecentEvents(3500);
    if (fresh.length) {
      const freshIds = new Set(fresh.map((e) => e.id));
      data.events = [...fresh, ...data.events.filter((e) => !freshIds.has(e.id))]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 90);
    }
  } catch {
    // Offline or rate-limited: the snapshot is good enough.
  }
  return data;
}

async function fetchRecentEvents(timeoutMs: number): Promise<ActivityItem[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(
      `https://api.github.com/users/${GITHUB_USER}/events/public?per_page=30`,
      { headers: { Accept: 'application/vnd.github+json' }, signal: ctrl.signal }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return normalizeEvents(await res.json());
  } finally {
    clearTimeout(timer);
  }
}
