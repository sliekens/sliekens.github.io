import { GITHUB_USER, SITE_REPO } from './config';
import { fmt, relTime } from './github/normalize';
import { ACTIVITY_STYLE } from './world/core';
import type { Exhibit } from './world/exhibits';
import { ROOM_ANCHORS } from './world/layout';

export interface UICallbacks {
  onEnter(): void;
  onTeleport(roomId: string): void;
  onOpenList(): void;
  /** Toggles render quality; returns the new state (true = high). */
  onToggleQuality(): boolean;
}

const esc = (s: unknown): string =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  );

const withHttp = (url: string): string => (url.startsWith('http') ? url : `https://${url}`);

const plural = (n: number, word: string): string => `${fmt(n)} ${word}${n === 1 ? '' : 's'}`;

function kindMeta(ex: Exhibit): { label: string; color: string } {
  switch (ex.kind) {
    case 'repo':
      return { label: 'REPOSITORY', color: '#4af2ff' };
    case 'event': {
      const s = ex.event ? ACTIVITY_STYLE[ex.event.type] : undefined;
      return { label: s?.label ?? 'ACTIVITY', color: s?.color ?? '#8b93b8' };
    }
    case 'day':
      return { label: 'GARDEN TILE', color: '#39d353' };
    case 'stat':
      return { label: 'STATISTIC', color: '#d4af37' };
    case 'profile':
      return { label: 'CURATOR', color: '#d4af37' };
    case 'link':
      return { label: 'PORTAL', color: '#4af2ff' };
    default:
      return { label: 'PLAQUE', color: '#8b93b8' };
  }
}

function renderPanel(ex: Exhibit): string {
  const meta = kindMeta(ex);
  let body = '';
  let actions = '';

  switch (ex.kind) {
    case 'repo': {
      const r = ex.repo!;
      body = `
        ${r.description ? `<p class="panel-desc">${esc(r.description)}</p>` : ''}
        <div class="chip-row">
          <span class="chip">${plural(r.stars, 'star')}</span>
          <span class="chip">${plural(r.forks, 'fork')}</span>
          ${r.language ? `<span class="chip"><i class="dot" style="background:${esc(r.languageColor || '#8b949e')}"></i>${esc(r.language)}</span>` : ''}
          ${r.openIssues ? `<span class="chip">${plural(r.openIssues, 'open issue')}</span>` : ''}
          ${r.archived ? '<span class="chip warn">archived</span>' : ''}
          ${r.isFork ? '<span class="chip">fork</span>' : ''}
        </div>
        ${
          r.topics.length
            ? `<div class="chip-row topics">${r.topics
                .slice(0, 8)
                .map((t) => `<span class="chip topic">${esc(t)}</span>`)
                .join('')}</div>`
            : ''
        }
        <dl class="meta">
          <div><dt>Created</dt><dd>${esc(new Date(r.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }))}</dd></div>
          <div><dt>Last push</dt><dd title="${esc(r.pushedAt)}">${esc(relTime(r.pushedAt))}</dd></div>
        </dl>
        ${r.name === SITE_REPO ? '<p class="easter">You are standing inside this exhibit right now.</p>' : ''}
      `;
      actions = `<a class="btn" href="${esc(r.htmlUrl)}" target="_blank" rel="noopener">View on GitHub</a>`;
      if (r.homepage)
        actions += `<a class="btn ghost" href="${esc(withHttp(r.homepage))}" target="_blank" rel="noopener">Homepage</a>`;
      if (r.hasPages && r.name !== SITE_REPO)
        actions += `<button class="btn ghost" data-demo="https://${GITHUB_USER}.github.io/${encodeURIComponent(r.name)}/">Live demo</button>`;
      break;
    }
    case 'event': {
      const ev = ex.event!;
      body = `
        ${ev.detail ? `<blockquote class="panel-quote">${esc(ev.detail)}</blockquote>` : ''}
        <dl class="meta">
          <div><dt>Repository</dt><dd>${esc(ev.repo)}</dd></div>
          <div><dt>When</dt><dd title="${esc(ev.createdAt)}">${esc(relTime(ev.createdAt))}</dd></div>
        </dl>`;
      actions = `<a class="btn" href="${esc(ev.url)}" target="_blank" rel="noopener">Open on GitHub</a>`;
      break;
    }
    case 'day':
      body = `
        <p class="panel-desc">${esc(ex.subtitle ?? '')}</p>
        <p class="panel-dim">Tile height and glow scale with that day's contribution count.</p>`;
      actions = `<a class="btn" href="https://github.com/${GITHUB_USER}" target="_blank" rel="noopener">View profile</a>`;
      break;
    default: {
      body = ex.body ? `<p class="panel-desc prewrap">${esc(ex.body)}</p>` : '';
      if (ex.url) {
        const label = ex.kind === 'link' ? 'Open' : ex.kind === 'profile' ? 'Open profile' : 'View on GitHub';
        actions = `<a class="btn" href="${esc(ex.url)}" target="_blank" rel="noopener">${label}</a>`;
      }
    }
  }

  const showSub = ex.subtitle && ex.kind !== 'day' && ex.kind !== 'repo';
  return `
    <button class="panel-close" data-close aria-label="Close panel">×</button>
    <div class="panel-kind" style="color:${meta.color}">${esc(meta.label)}</div>
    <h2>${esc(ex.title)}</h2>
    ${showSub ? `<p class="panel-sub">${esc(ex.subtitle)}</p>` : ''}
    ${ex.kind === 'repo' && ex.subtitle ? '' : ''}
    ${body}
    <div class="panel-actions">${actions}</div>
    <div class="demo-slot"></div>`;
}

export interface UI {
  setLoading(msg: string): void;
  setReady(statusText: string): void;
  showError(msg: string): void;
  hideIntro(): void;
  setLockState(locked: boolean): void;
  setTouch(touch: boolean): void;
  fade(mid: () => void): void;
  toast(msg: string): void;
  toggleHelp(): void;
  setQualityLabel(high: boolean): void;
  tooltip: {
    show(title: string, sub: string | undefined, x: number, y: number, centered: boolean): void;
    hide(): void;
  };
  panel: { open(ex: Exhibit): void; close(): void; isOpen(): boolean };
}

export function createUI(cb: UICallbacks): UI {
  const root = document.getElementById('overlay')!;
  root.innerHTML = `
    <div id="intro">
      <div class="intro-inner">
        <div class="intro-kicker">sliekens.github.io presents</div>
        <h1>PALACE OF<br>NERDY COLLECTIONS</h1>
        <p class="intro-sub">A walkable museum of one developer's GitHub activity</p>
        <p class="intro-status" id="intro-status">Contacting GitHub…</p>
        <div class="intro-actions">
          <button id="enter-btn" class="btn big" disabled>Enter the museum</button>
          <button id="intro-list-btn" class="btn ghost big">Browse as a list</button>
        </div>
        <div class="intro-controls" id="intro-controls">
          <span><b>WASD</b> walk</span><span><b>mouse</b> look</span><span><b>click</b> inspect</span><span><b>shift</b> run</span><span><b>1–5</b> rooms</span><span><b>esc</b> cursor</span>
        </div>
      </div>
    </div>
    <div id="hud" hidden>
      <div id="hud-top">
        <div id="hud-brand">PALACE OF NERDY COLLECTIONS</div>
        <div id="hud-actions">
          <button id="hud-help" class="hud-btn" title="Help (H)">?</button>
          <button id="hud-quality" class="hud-btn" title="Toggle visual effects">FX HIGH</button>
          <button id="hud-list" class="hud-btn" title="Accessible list view (L)">LIST</button>
        </div>
      </div>
      <nav id="hud-nav">
        ${ROOM_ANCHORS.map(
          (a) => `<button data-room="${a.id}"><span class="key">${a.key}</span>${a.label}</button>`
        ).join('')}
      </nav>
      <div id="crosshair"></div>
      <div id="hint"></div>
    </div>
    <div id="tooltip" hidden></div>
    <aside id="panel" aria-live="polite"></aside>
    <div id="help-overlay" hidden>
      <div class="help-card">
        <h3>VISITOR GUIDE</h3>
        <div class="help-grid">
          <span><b>WASD / arrows</b></span><span>walk around</span>
          <span><b>mouse</b></span><span>look (click the view to grab the cursor)</span>
          <span><b>click</b></span><span>inspect the exhibit under the crosshair</span>
          <span><b>shift</b></span><span>walk faster</span>
          <span><b>1–5</b></span><span>teleport between rooms</span>
          <span><b>L</b></span><span>accessible list view</span>
          <span><b>esc</b></span><span>release the cursor / close panels</span>
        </div>
        <p class="help-note">Crystals in the gallery are sized by stars and colored by language. Garden tiles are one day of contributions each. Everything glowing is probably clickable.</p>
        <button class="btn" id="help-close">Back to the museum</button>
      </div>
    </div>
    <div id="fade"></div>
    <div id="toasts"></div>
  `;

  const $ = <T extends HTMLElement = HTMLElement>(sel: string): T =>
    root.querySelector(sel) as T;
  const intro = $('#intro');
  const status = $('#intro-status');
  const enterBtn = $<HTMLButtonElement>('#enter-btn');
  const hud = $('#hud');
  const hint = $('#hint');
  const tooltipEl = $('#tooltip');
  const panelEl = $('#panel');
  const helpEl = $('#help-overlay');
  const fadeEl = $('#fade');
  const toasts = $('#toasts');
  const qualityBtn = $<HTMLButtonElement>('#hud-quality');

  let entered = false;
  let lockedState = false;
  let panelOpen = false;
  let touchMode = false;

  function refreshHint(): void {
    let text = '';
    if (entered) {
      if (touchMode) text = panelOpen ? '' : 'Left half: move · right half: look · tap exhibits to inspect';
      else if (lockedState) text = 'Aim at an exhibit and click · ESC frees the cursor';
      else text = panelOpen ? 'Click the world to keep exploring' : 'Click the view to grab the cursor · 1–5 jumps between rooms';
    }
    hint.textContent = text;
    hint.classList.toggle('show', Boolean(text));
  }

  const api: UI = {
    setLoading(msg) {
      status.textContent = msg;
      status.classList.remove('error');
    },
    setReady(statusText) {
      status.textContent = statusText;
      enterBtn.disabled = false;
      enterBtn.focus();
    },
    showError(msg) {
      status.innerHTML = `${esc(msg)} — <a href="javascript:location.reload()">retry</a>`;
      status.classList.add('error');
    },
    hideIntro() {
      entered = true;
      intro.classList.add('gone');
      hud.hidden = false;
      document.body.classList.add('entered');
      setTimeout(() => {
        intro.hidden = true;
      }, 600);
      refreshHint();
    },
    setLockState(locked) {
      lockedState = locked;
      document.body.classList.toggle('locked', locked);
      if (locked) api.tooltip.hide();
      refreshHint();
    },
    setTouch(touch) {
      touchMode = touch;
      document.body.classList.toggle('touch', touch);
      if (touch) {
        $('#intro-controls').innerHTML =
          '<span><b>left half</b> move</span><span><b>right half</b> look</span><span><b>tap</b> inspect</span>';
      }
      refreshHint();
    },
    fade(mid) {
      fadeEl.classList.add('on');
      setTimeout(() => {
        mid();
        setTimeout(() => fadeEl.classList.remove('on'), 80);
      }, 180);
    },
    toast(msg) {
      const t = document.createElement('div');
      t.className = 'toast';
      t.textContent = msg;
      toasts.appendChild(t);
      setTimeout(() => t.remove(), 3600);
    },
    toggleHelp() {
      helpEl.hidden = !helpEl.hidden;
    },
    setQualityLabel(high) {
      qualityBtn.textContent = high ? 'FX HIGH' : 'FX LOW';
    },
    tooltip: {
      show(title, sub, x, y, centered) {
        tooltipEl.innerHTML = `<b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}`;
        tooltipEl.hidden = false;
        tooltipEl.classList.toggle('centered', centered);
        if (!centered) {
          const pad = 14;
          const w = tooltipEl.offsetWidth;
          const h = tooltipEl.offsetHeight;
          tooltipEl.style.left = `${Math.min(x + pad, window.innerWidth - w - 8)}px`;
          tooltipEl.style.top = `${Math.min(y + pad, window.innerHeight - h - 8)}px`;
        } else {
          tooltipEl.style.left = '';
          tooltipEl.style.top = '';
        }
      },
      hide() {
        tooltipEl.hidden = true;
      },
    },
    panel: {
      open(ex) {
        panelEl.innerHTML = renderPanel(ex);
        panelEl.classList.add('open');
        panelOpen = true;
        api.tooltip.hide();
        refreshHint();
      },
      close() {
        if (!panelOpen) return;
        panelEl.classList.remove('open');
        panelOpen = false;
        refreshHint();
      },
      isOpen: () => panelOpen,
    },
  };

  enterBtn.addEventListener('click', () => cb.onEnter());
  $('#intro-list-btn').addEventListener('click', () => cb.onOpenList());
  $('#hud-list').addEventListener('click', () => cb.onOpenList());
  $('#hud-help').addEventListener('click', () => api.toggleHelp());
  $('#help-close').addEventListener('click', () => api.toggleHelp());
  qualityBtn.addEventListener('click', () => api.setQualityLabel(cb.onToggleQuality()));
  $('#hud-nav').addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-room]') as HTMLElement | null;
    if (btn) cb.onTeleport(btn.getAttribute('data-room')!);
  });
  panelEl.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-close]')) {
      api.panel.close();
      return;
    }
    const demoBtn = target.closest('[data-demo]') as HTMLElement | null;
    if (demoBtn) {
      const slot = panelEl.querySelector('.demo-slot') as HTMLElement;
      if (slot.childElementCount) {
        slot.innerHTML = '';
        demoBtn.textContent = 'Live demo';
      } else {
        const url = demoBtn.getAttribute('data-demo')!;
        slot.innerHTML = `
          <div class="demo-wrap">
            <iframe src="${esc(url)}" loading="lazy" referrerpolicy="no-referrer" title="Live demo"></iframe>
            <a href="${esc(url)}" target="_blank" rel="noopener" class="demo-pop">Open in a new tab</a>
          </div>`;
        demoBtn.textContent = 'Close demo';
      }
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!helpEl.hidden) helpEl.hidden = true;
      else if (panelOpen) api.panel.close();
    }
  });

  return api;
}
