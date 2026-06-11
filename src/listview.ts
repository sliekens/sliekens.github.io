import { GITHUB_USER, SITE_REPO } from './config';
import { fmt, relTime, summarizeCalendar } from './github/normalize';
import type { GithubData } from './github/types';
import { ACTIVITY_STYLE } from './world/core';

const esc = (s: unknown): string =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  );

/**
 * The 2D fallback: every exhibit as plain, filterable HTML. Used when WebGL
 * is unavailable and always reachable from the museum (L key / LIST button).
 */
export function openListView(data: GithubData, canExit: boolean, onClose?: () => void): void {
  let el = document.getElementById('listview');
  if (!el) {
    el = document.createElement('div');
    el.id = 'listview';
    document.body.appendChild(el);
  }
  const p = data.profile;
  const summary = summarizeCalendar(data.calendar);
  const calOk = data.calendar.source !== 'none';

  el.innerHTML = `
    <div class="list-shell">
      <header class="list-head">
        <img src="${esc(p.avatarUrl)}" alt="" class="list-avatar" />
        <div>
          <h1>${esc(p.name)}</h1>
          <p class="list-login"><a href="${esc(p.htmlUrl)}" target="_blank" rel="noopener">@${esc(p.login)}</a>${p.bio ? ` · ${esc(p.bio)}` : ''}</p>
          <p class="list-stats">
            ${fmt(p.publicRepos)} repos · ${fmt(data.totalStars)} stars · ${fmt(p.followers)} followers${calOk ? ` · ${data.calendar.total.toLocaleString('en-US')} contributions this year` : ''}
          </p>
        </div>
        ${canExit ? '<button class="btn ghost" id="list-close">Back to 3D</button>' : ''}
      </header>
      <input id="list-filter" type="search" placeholder="Filter repositories and activity…" autocomplete="off" />
      ${
        calOk
          ? `<section><h2>Contributions</h2><p class="list-dim">${data.calendar.total.toLocaleString('en-US')} in the past year · best day ${summary.bestDay ? `${summary.bestDay.count} on ${esc(summary.bestDay.date)}` : '—'} · longest streak ${summary.longestStreak} days · active on ${summary.activeDays} days${data.calendar.source === 'derived' ? ' (approximated from public events)' : ''}</p></section>`
          : ''
      }
      <section>
        <h2>Repositories (${data.repos.length})</h2>
        <div class="list-grid">
          ${data.repos
            .map(
              (r) => `
            <a class="list-card" data-search="${esc(`${r.name} ${r.description} ${r.language}`.toLowerCase())}" href="${esc(r.htmlUrl)}" target="_blank" rel="noopener">
              <span class="list-card-name">${esc(r.name)}${r.name === SITE_REPO ? ' <em>(you are here)</em>' : ''}</span>
              ${r.description ? `<span class="list-card-desc">${esc(r.description)}</span>` : ''}
              <span class="list-card-meta">
                ${r.language ? `<i class="dot" style="background:${esc(r.languageColor || '#8b949e')}"></i>${esc(r.language)} · ` : ''}${fmt(r.stars)} stars · ${fmt(r.forks)} forks${r.archived ? ' · archived' : ''}${r.isFork ? ' · fork' : ''} · ${esc(relTime(r.pushedAt))}
              </span>
            </a>`
            )
            .join('')}
        </div>
      </section>
      <section>
        <h2>Recent activity (${data.events.length})</h2>
        <ul class="list-events">
          ${data.events
            .map((ev) => {
              const style = ACTIVITY_STYLE[ev.type] ?? { label: ev.type, color: '#8b93b8' };
              return `
            <li data-search="${esc(`${ev.title} ${ev.repo} ${ev.detail}`.toLowerCase())}">
              <span class="chip" style="color:${style.color};border-color:${style.color}40">${esc(style.label)}</span>
              <a href="${esc(ev.url)}" target="_blank" rel="noopener">${esc(ev.title)}</a>
              <span class="list-dim">${esc(ev.repo)}${ev.detail ? ` — ${esc(ev.detail)}` : ''} · ${esc(relTime(ev.createdAt))}</span>
            </li>`;
            })
            .join('')}
        </ul>
      </section>
      ${
        data.languages.length
          ? `<section><h2>Languages</h2><div class="chip-row">${data.languages
              .map(
                (l) =>
                  `<span class="chip"><i class="dot" style="background:${esc(l.color)}"></i>${esc(l.name)} · ${l.repoCount}</span>`
              )
              .join('')}</div></section>`
          : ''
      }
      <footer class="list-foot">
        Snapshot generated ${esc(relTime(data.generatedAt))} · recent activity refreshed on page load when the public API allows ·
        <a href="https://github.com/${GITHUB_USER}/${SITE_REPO}" target="_blank" rel="noopener">museum source</a>
      </footer>
    </div>
  `;
  el.hidden = false;

  const filter = el.querySelector<HTMLInputElement>('#list-filter')!;
  filter.addEventListener('input', () => {
    const q = filter.value.trim().toLowerCase();
    el!.querySelectorAll<HTMLElement>('[data-search]').forEach((item) => {
      item.classList.toggle('filtered', Boolean(q) && !item.dataset.search!.includes(q));
    });
  });

  const close = (): void => {
    el!.hidden = true;
    onClose?.();
  };
  el.querySelector('#list-close')?.addEventListener('click', close);
  if (canExit) {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !el!.hidden) {
        close();
        document.removeEventListener('keydown', onKey);
      }
    };
    document.addEventListener('keydown', onKey);
  }
  filter.focus();
}
