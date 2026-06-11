import * as THREE from 'three';

import { GITHUB_USER, SITE_REPO } from '../config';
import {
  dayLevels,
  fmt,
  languageColor,
  relTime,
  summarizeCalendar,
} from '../github/normalize';
import type { GithubData, Repo } from '../github/types';
import {
  ACTIVITY_STYLE,
  CONTRIB_COLORS,
  PALETTE,
  contactShadow,
  makeText,
  neonMaterial,
  radialTexture,
  type WorldCtx,
} from './core';
import { GARDEN_PIT } from './layout';

const dateShort = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const truncate = (s: string, max: number): string =>
  s.length > max ? `${s.slice(0, max - 1)}…` : s;

/* ------------------------------------------------------------------ */
/* Entrance rotunda: avatar hologram + headline stat plinths           */
/* ------------------------------------------------------------------ */

export function buildEntrance(ctx: WorldCtx, data: GithubData): void {
  const { scene, mats, registry, updatables, reducedMotion } = ctx;
  const p = data.profile;

  const group = new THREE.Group();
  group.position.set(0, 0, -3);

  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 1.1, 24), mats.pedestal);
  plinth.position.y = 0.55;
  group.add(plinth);
  const plinthTrim = new THREE.Mesh(new THREE.TorusGeometry(0.88, 0.025, 8, 48), mats.trimGold);
  plinthTrim.rotation.x = Math.PI / 2;
  plinthTrim.position.y = 1.08;
  group.add(plinthTrim);
  group.add(contactShadow(1.6));

  // Floating holographic portrait inside a slowly sweeping ring.
  const holo = new THREE.Group();
  holo.position.y = 2.55;
  const portraitMat = new THREE.MeshBasicMaterial({ color: 0x1c2f55, side: THREE.DoubleSide });
  const portrait = new THREE.Mesh(new THREE.CircleGeometry(1.15, 48), portraitMat);
  holo.add(portrait);
  if (p.avatarUrl) {
    new THREE.TextureLoader().load(p.avatarUrl, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      portraitMat.map = tex;
      portraitMat.color.setHex(0xffffff);
      portraitMat.needsUpdate = true;
    });
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.035, 10, 72), neonMaterial(PALETTE.cyan, 1.6));
  ring.rotation.x = 0.16;
  holo.add(ring);
  group.add(holo);

  const name = makeText({ text: p.name, size: 0.4, color: PALETTE.textGold, bold: true });
  name.position.set(0, 1.62, 0.4);
  group.add(name);
  const tag = makeText({
    text: `@${p.login}${p.bio ? ` · ${truncate(p.bio, 48)}` : ''}`,
    size: 0.15,
    color: PALETTE.textDim,
    maxWidth: 4.5,
  });
  tag.position.set(0, 1.3, 0.4);
  group.add(tag);

  scene.add(group);
  if (!reducedMotion) {
    updatables.push((dt, e) => {
      holo.position.y = 2.55 + Math.sin(e * 1.1) * 0.06;
      ring.rotation.y += dt * 0.45;
    });
  }

  registry.register(group, {
    kind: 'profile',
    title: p.name,
    subtitle: `@${p.login}`,
    url: p.htmlUrl,
    focus: { x: 0, z: 0.4, lookX: 0, lookY: 2.3, lookZ: -3 },
    ringY: 0.02,
    ringRadius: 1.45,
  });

  // Four stat plinths around the center.
  const calOk = data.calendar.source !== 'none';
  const stats: { x: number; z: number; value: string; label: string; body: string }[] = [
    {
      x: 4.6,
      z: -4.6,
      value: fmt(p.publicRepos),
      label: 'PUBLIC REPOS',
      body: 'Public repositories on GitHub, including forks. The most interesting ones are on display in the Repository Gallery, through the north door.',
    },
    {
      x: -4.6,
      z: -4.6,
      value: fmt(data.totalStars),
      label: 'TOTAL STARS',
      body: 'Stargazers collected across all public repositories.',
    },
    {
      x: -4.6,
      z: 4.6,
      value: fmt(p.followers),
      label: 'FOLLOWERS',
      body: 'People following this account on GitHub.',
    },
    {
      x: 4.6,
      z: 4.6,
      value: calOk ? data.calendar.total.toLocaleString('en-US') : '—',
      label: 'CONTRIBUTIONS',
      body: calOk
        ? `Contributions in the past year${data.calendar.source === 'derived' ? ' (approximated from public events)' : ''}. Walk the Contribution Garden, through the west door, to see every single day.`
        : 'Contribution data becomes available once the site is built with an API token.',
    },
  ];
  for (const s of stats) {
    const g = new THREE.Group();
    g.position.set(s.x, 0, s.z);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.2, 0.95), mats.pedestal);
    base.position.y = 0.6;
    g.add(base);
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.06, 1.05), mats.trimGold);
    top.position.y = 1.23;
    g.add(top);
    g.add(contactShadow(0.95));

    const faceYaw = Math.atan2(-s.x, -s.z);
    const value = makeText({ text: s.value, size: 0.5, color: PALETTE.textGold, bold: true });
    value.position.set(0, 1.78, 0);
    value.rotation.y = faceYaw;
    g.add(value);
    const label = makeText({ text: s.label, size: 0.14, color: PALETTE.textDim, letterSpacing: 0.08 });
    label.position.set(0, 1.45, 0);
    label.rotation.y = faceYaw;
    g.add(label);

    scene.add(g);
    const d = Math.hypot(s.x, s.z);
    const f = (d - 2.4) / d;
    registry.register(g, {
      kind: 'stat',
      title: `${s.value} ${s.label.toLowerCase()}`,
      body: s.body,
      url: data.profile.htmlUrl,
      focus: { x: s.x * f, z: s.z * f, lookX: s.x, lookY: 1.55, lookZ: s.z },
      ringY: 0.02,
      ringRadius: 0.85,
    });
  }
}

/* ------------------------------------------------------------------ */
/* Repository Gallery: pedestals with language-colored crystals        */
/* ------------------------------------------------------------------ */

function galleryRepos(data: GithubData): Repo[] {
  return data.repos.filter((r) => !r.isFork || r.pinned).slice(0, 11);
}

export function buildGallery(ctx: WorldCtx, data: GithubData): void {
  const { scene, mats, registry, updatables, reducedMotion } = ctx;
  const repos = galleryRepos(data);

  if (!repos.length) {
    const t = makeText({ text: 'No public repositories yet', size: 0.3, color: PALETTE.textDim });
    t.position.set(0, 2.2, -30);
    scene.add(t);
    return;
  }

  const [featured, ...rest] = repos;
  buildPedestal(ctx, featured, 0, -43.8, true);
  rest.forEach((repo, i) => {
    const row = Math.floor(i / 2);
    const x = i % 2 === 0 ? -5 : 5;
    buildPedestal(ctx, repo, x, -20.5 - row * 5.2, false);
  });

  // Language legend on the west wall, near the entrance.
  const langs = data.languages.slice(0, 6);
  if (langs.length) {
    const panel = new THREE.Group();
    panel.position.set(-7.75, 0, -19.5);
    panel.rotation.y = Math.PI / 2;
    const backing = new THREE.Mesh(new THREE.BoxGeometry(2.7, 2.3, 0.08), mats.pedestal);
    backing.position.y = 2.45;
    panel.add(backing);
    const title = makeText({
      text: 'LANGUAGES',
      size: 0.16,
      color: PALETTE.textGold,
      bold: true,
      letterSpacing: 0.1,
    });
    title.position.set(0, 3.35, 0.06);
    panel.add(title);
    langs.forEach((lang, i) => {
      const y = 3.02 - i * 0.3;
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.065, 16), neonMaterial(lang.color, 1.4));
      dot.position.set(-1.05, y, 0.06);
      panel.add(dot);
      const row = makeText({
        text: `${truncate(lang.name, 16)}  ${lang.repoCount}`,
        size: 0.13,
        color: PALETTE.textMain,
        anchorX: 'left',
      });
      row.position.set(-0.85, y, 0.06);
      panel.add(row);
    });
    scene.add(panel);
    registry.register(panel, {
      kind: 'info',
      title: 'Languages',
      subtitle: 'Primary language per repository',
      body: langs.map((l) => `${l.name} — ${l.repoCount} ${l.repoCount === 1 ? 'repo' : 'repos'}`).join('\n'),
      focus: { x: -5.4, z: -19.5, lookX: -7.75, lookY: 2.6, lookZ: -19.5 },
      ringY: 0.02,
      ringRadius: 0.9,
    });
  }

  void updatables;
  void reducedMotion;
  void mats;
}

function buildPedestal(ctx: WorldCtx, repo: Repo, x: number, z: number, featured: boolean): void {
  const { scene, mats, registry, updatables, reducedMotion } = ctx;
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  // Rotate the whole pedestal so the plaque (built on local +z) faces the aisle.
  group.rotation.y = featured ? 0 : x < 0 ? Math.PI / 2 : -Math.PI / 2;

  let topY: number;
  if (featured) {
    const s1 = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.4, 0.3, 28), mats.pedestal);
    s1.position.y = 0.15;
    group.add(s1);
    const s2 = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.1, 0.35, 28), mats.pedestal);
    s2.position.y = 0.475;
    group.add(s2);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 1.35, 14), mats.column);
    col.position.y = 1.32;
    group.add(col);
    topY = 2.0;
  } else {
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.55, 1.4), mats.pedestal);
    base.position.y = 0.275;
    group.add(base);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 1.0, 12), mats.column);
    col.position.y = 1.05;
    group.add(col);
    topY = 1.55;
  }
  group.add(contactShadow(featured ? 1.7 : 1.2));

  const color = repo.languageColor || languageColor(repo.language);
  const size = Math.min(1.6, 0.8 + Math.log10(repo.stars + 2) * 0.45) + (featured ? 0.15 : 0);
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), neonMaterial(color, 1.9));
  crystal.scale.set(size, size * 1.55, size);
  const crystalY = topY + 0.72;
  crystal.position.y = crystalY;
  group.add(crystal);

  if (featured) {
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.025, 8, 48), mats.trimGold);
    halo.rotation.x = Math.PI / 2;
    halo.position.y = crystalY;
    group.add(halo);
  }

  // Tilted plaque on a short post at the front edge.
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.78, 0.08), mats.column);
  post.position.set(0, 0.39, featured ? 1.55 : 1.0);
  group.add(post);
  const plaque = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.52, 0.045), mats.pedestal);
  plaque.position.set(0, 0.92, featured ? 1.62 : 1.07);
  plaque.rotation.x = -0.5;
  group.add(plaque);

  const nameText = makeText({
    text: truncate(repo.name, 26),
    size: 0.095,
    color: PALETTE.textMain,
    bold: true,
    maxWidth: 0.95,
  });
  nameText.position.set(0, 0.13, 0.028);
  plaque.add(nameText);
  const meta = makeText({
    text: `${repo.stars} stars · ${repo.language || 'misc'}`,
    size: 0.075,
    color: color,
    maxWidth: 0.95,
  });
  meta.position.set(0, -0.05, 0.028);
  plaque.add(meta);
  const when = makeText({
    text: repo.archived ? 'archived' : `updated ${relTime(repo.pushedAt)}`,
    size: 0.065,
    color: PALETTE.textDim,
    maxWidth: 0.95,
  });
  when.position.set(0, -0.17, 0.028);
  plaque.add(when);

  scene.add(group);

  if (!reducedMotion) {
    const phase = Math.random() * Math.PI * 2;
    updatables.push((dt, e) => {
      crystal.rotation.y += dt * 0.5;
      crystal.position.y = crystalY + Math.sin(e * 1.2 + phase) * 0.07;
    });
  } else {
    crystal.rotation.y = Math.random() * Math.PI;
  }

  const stand = featured ? { x: 0, z: z + 3.4 } : { x: x < 0 ? x + 2.7 : x - 2.7, z };
  registry.register(group, {
    kind: 'repo',
    title: repo.name,
    subtitle: repo.description ? truncate(repo.description, 70) : undefined,
    url: repo.htmlUrl,
    repo,
    focus: { x: stand.x, z: stand.z, lookX: x, lookY: topY + 0.5, lookZ: z },
    ringY: 0.02,
    ringRadius: featured ? 1.55 : 1.1,
  });
}

/* ------------------------------------------------------------------ */
/* Contribution Garden: walkable heatmap pit                           */
/* ------------------------------------------------------------------ */

export interface DayCell {
  date: string;
  count: number;
  level: number;
  x: number;
  z: number;
  h: number;
}

export interface CalendarPick {
  mesh: THREE.InstancedMesh;
  days: DayCell[];
}

export function buildGarden(ctx: WorldCtx, data: GithubData): CalendarPick | null {
  const { scene, registry, updatables, reducedMotion } = ctx;
  const cal = data.calendar;
  const levels = dayLevels(cal);
  const summary = summarizeCalendar(cal);

  // Lay the tiles: one column per week (x), one row per weekday (z).
  const cells: DayCell[] = [];
  const weekCount = cal.weeks.length;
  let maxCount = 1;
  for (const w of cal.weeks) for (const d of w.days) maxCount = Math.max(maxCount, d.count);
  cal.weeks.forEach((week, w) => {
    for (const day of week.days) {
      const dow = new Date(`${day.date}T00:00:00Z`).getUTCDay();
      cells.push({
        date: day.date,
        count: day.count,
        level: levels.get(day.date) ?? 0,
        x: -29 + (w - (weekCount - 1) / 2) * 0.34,
        z: (dow - 3) * 0.34,
        h: 0.06 + (day.count > 0 ? Math.sqrt(day.count / maxCount) * 1.35 : 0),
      });
    }
  });

  let mesh: THREE.InstancedMesh | null = null;
  if (cells.length) {
    const geo = new THREE.BoxGeometry(0.3, 1, 0.3).translate(0, 0.5, 0);
    const mat = new THREE.MeshBasicMaterial();
    mesh = new THREE.InstancedMesh(geo, mat, cells.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const colorScratch = new THREE.Color();
    cells.forEach((c, i) => {
      m.compose(
        new THREE.Vector3(c.x, -GARDEN_PIT.depth, c.z),
        q,
        new THREE.Vector3(1, c.h, 1)
      );
      mesh!.setMatrixAt(i, m);
      mesh!.setColorAt(i, colorScratch.set(CONTRIB_COLORS[c.level]));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.userData.kind = 'calendar';
    scene.add(mesh);

    // The most recent day pulses gently.
    if (!reducedMotion && cal.source !== 'none') {
      const i = cells.length - 1;
      const c = cells[i];
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const pm = new THREE.Matrix4();
      const pq = new THREE.Quaternion();
      updatables.push((_dt, e) => {
        const s = c.h * (1 + 0.16 * (0.5 + 0.5 * Math.sin(e * 2.6))) + 0.05;
        pm.compose(new THREE.Vector3(c.x, -GARDEN_PIT.depth, c.z), pq, new THREE.Vector3(1, s, 1));
        mesh!.setMatrixAt(i, pm);
        mesh!.instanceMatrix.needsUpdate = true;
      });
    }
  }

  // Headline number on the north wall.
  const headline = new THREE.Group();
  const calOk = cal.source !== 'none';
  const big = makeText({
    text: calOk ? cal.total.toLocaleString('en-US') : '—',
    size: 0.85,
    color: PALETTE.textGold,
    bold: true,
  });
  big.position.set(-29, 3.45, -12.75);
  headline.add(big);
  const sub = makeText({
    text: 'CONTRIBUTIONS IN THE PAST YEAR',
    size: 0.2,
    color: PALETTE.textMain,
    letterSpacing: 0.1,
  });
  sub.position.set(-29, 2.8, -12.75);
  headline.add(sub);
  if (cal.source === 'derived') {
    const note = makeText({
      text: '(approximated from recent public events)',
      size: 0.13,
      color: PALETTE.textDim,
    });
    note.position.set(-29, 2.5, -12.75);
    headline.add(note);
  }
  scene.add(headline);
  registry.register(headline, {
    kind: 'stat',
    title: calOk ? `${cal.total.toLocaleString('en-US')} contributions` : 'Contributions',
    body: calOk
      ? `Every tile in the garden pit is one day from the past 53 weeks. Taller, brighter tiles mean more contributions that day.${cal.source === 'derived' ? ' This calendar is approximated from recent public events; the full version appears when the site is built with an API token.' : ''} Hover any tile to inspect it.`
      : 'Contribution data becomes available once the site is built with an API token.',
    url: `https://github.com/${GITHUB_USER}`,
    focus: { x: -29, z: -5.5, lookX: -29, lookY: 3, lookZ: -12.9 },
    ringY: 0.02,
    ringRadius: 1.2,
  });

  // Streak stats on the south wall.
  const best = summary.bestDay;
  const stats: { x: number; value: string; label: string; body: string }[] = [
    {
      x: -34.5,
      value: String(summary.currentStreak),
      label: 'CURRENT STREAK',
      body: `${summary.currentStreak} consecutive day${summary.currentStreak === 1 ? '' : 's'} with at least one contribution, counting back from today.`,
    },
    {
      x: -29,
      value: String(summary.longestStreak),
      label: 'LONGEST STREAK',
      body: `The longest run of consecutive contribution days in the past year: ${summary.longestStreak} day${summary.longestStreak === 1 ? '' : 's'}.`,
    },
    {
      x: -23.5,
      value: best ? String(best.count) : '0',
      label: 'BUSIEST DAY',
      body: best
        ? `${best.count} contributions on ${new Date(`${best.date}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} — the busiest day of the year.`
        : 'No contributions recorded in the past year.',
    },
  ];
  if (calOk) {
    for (const s of stats) {
      const g = new THREE.Group();
      const value = makeText({ text: s.value, size: 0.48, color: '#7ee787', bold: true });
      value.position.set(s.x, 2.55, 12.75);
      value.rotation.y = Math.PI;
      g.add(value);
      const label = makeText({ text: s.label, size: 0.13, color: PALETTE.textDim, letterSpacing: 0.1 });
      label.position.set(s.x, 2.15, 12.75);
      label.rotation.y = Math.PI;
      g.add(label);
      scene.add(g);
      registry.register(g, {
        kind: 'stat',
        title: `${s.label.toLowerCase()}: ${s.value}`,
        body: s.body,
        focus: { x: s.x, z: 5.8, lookX: s.x, lookY: 2.35, lookZ: 12.9 },
        ringY: 0.02,
        ringRadius: 1.0,
      });
    }
  }

  // Fireflies drifting over the pit.
  if (!reducedMotion && cells.length) {
    const count = 18;
    const base = new Float32Array(count * 3);
    const phase = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      base[i * 3] = GARDEN_PIT.x1 + 1 + Math.random() * (GARDEN_PIT.x2 - GARDEN_PIT.x1 - 2);
      base[i * 3 + 1] = 0.4 + Math.random() * 1.4;
      base[i * 3 + 2] = GARDEN_PIT.z1 + 0.6 + Math.random() * (GARDEN_PIT.z2 - GARDEN_PIT.z1 - 1.2);
      phase[i] = Math.random() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(base.slice(), 3));
    const flies = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 0.07,
        map: radialTexture(),
        color: 0x66ff99,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    scene.add(flies);
    updatables.push((_dt, e) => {
      const arr = geo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < count; i++) {
        arr.setX(i, base[i * 3] + Math.sin(e * 0.3 + phase[i]) * 0.8);
        arr.setY(i, base[i * 3 + 1] + Math.sin(e * 0.7 + phase[i] * 2) * 0.25);
        arr.setZ(i, base[i * 3 + 2] + Math.cos(e * 0.4 + phase[i]) * 0.5);
      }
      arr.needsUpdate = true;
    });
  }

  return mesh ? { mesh, days: cells } : null;
}

/* ------------------------------------------------------------------ */
/* Activity Timeline: wall tablets, newest first                       */
/* ------------------------------------------------------------------ */

export function buildTimeline(ctx: WorldCtx, data: GithubData): void {
  const { scene, registry } = ctx;
  const events = data.events.slice(0, 24);

  const sign = makeText({
    text: 'RECENT ACTIVITY — NEWEST TO OLDEST',
    size: 0.17,
    color: PALETTE.textDim,
    letterSpacing: 0.08,
  });
  sign.position.set(17.4, 2.9, 0);
  sign.rotation.y = -Math.PI / 2;
  scene.add(sign);

  if (!events.length) {
    const empty = makeText({ text: 'No recent public activity', size: 0.28, color: PALETTE.textDim });
    empty.position.set(28, 1.9, 0);
    empty.rotation.y = -Math.PI / 2;
    scene.add(empty);
    return;
  }

  const boardMat = new THREE.MeshStandardMaterial({ color: 0x141830, roughness: 0.6, metalness: 0.2 });

  events.forEach((ev, i) => {
    const col = Math.floor(i / 2);
    const side = i % 2 === 0 ? -1 : 1;
    const x = 18.5 + col * 2.3;
    const style = ACTIVITY_STYLE[ev.type] ?? { label: ev.type.toUpperCase(), color: '#8b93b8' };

    const group = new THREE.Group();
    group.position.set(x, 0, side * 3.62);
    group.rotation.y = side < 0 ? 0 : Math.PI;

    const rim = new THREE.Mesh(new THREE.BoxGeometry(2.06, 1.56, 0.05), neonMaterial(style.color, 1.0));
    rim.position.set(0, 1.85, -0.015);
    group.add(rim);
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.96, 1.46, 0.07), boardMat);
    board.position.set(0, 1.85, 0);
    group.add(board);

    const header = makeText({
      text: `${style.label} · ${dateShort(ev.createdAt)}`,
      size: 0.085,
      color: style.color,
      bold: true,
      anchorX: 'left',
      anchorY: 'top',
      letterSpacing: 0.05,
    });
    header.position.set(-0.88, 2.48, 0.045);
    group.add(header);
    const title = makeText({
      text: truncate(ev.title, 60),
      size: 0.115,
      color: PALETTE.textMain,
      anchorX: 'left',
      anchorY: 'top',
      maxWidth: 1.78,
      align: 'left',
      lineHeight: 1.25,
    });
    title.position.set(-0.88, 2.3, 0.045);
    group.add(title);
    if (ev.detail) {
      const detail = makeText({
        text: truncate(ev.detail, 72),
        size: 0.082,
        color: PALETTE.textDim,
        anchorX: 'left',
        anchorY: 'top',
        maxWidth: 1.78,
        align: 'left',
        lineHeight: 1.3,
      });
      detail.position.set(-0.88, 1.82, 0.045);
      group.add(detail);
    }
    const repoLine = makeText({
      text: truncate(ev.repo, 34),
      size: 0.08,
      color: '#9da8d8',
      anchorX: 'left',
    });
    repoLine.position.set(-0.88, 1.28, 0.045);
    group.add(repoLine);

    scene.add(group);
    registry.register(group, {
      kind: 'event',
      title: ev.title,
      subtitle: ev.repo,
      url: ev.url,
      event: ev,
      focus: { x, z: side * 1.15, lookX: x, lookY: 1.85, lookZ: side * 3.62 },
      ringY: 0.02,
      ringRadius: 0.95,
    });
  });
}

/* ------------------------------------------------------------------ */
/* About wing: bio wall + link pedestals + oldest artifact             */
/* ------------------------------------------------------------------ */

export function buildAbout(ctx: WorldCtx, data: GithubData): void {
  const { scene, mats, registry, updatables, reducedMotion } = ctx;
  const p = data.profile;

  const wall = new THREE.Group();
  const heading = makeText({
    text: 'ABOUT THE CURATOR',
    size: 0.18,
    color: PALETTE.textGold,
    bold: true,
    letterSpacing: 0.12,
  });
  heading.position.set(0, 3.6, 23.75);
  heading.rotation.y = Math.PI;
  wall.add(heading);
  const name = makeText({ text: p.name, size: 0.34, color: PALETTE.textMain, bold: true });
  name.position.set(0, 3.15, 23.75);
  name.rotation.y = Math.PI;
  wall.add(name);
  if (p.bio) {
    const bio = makeText({
      text: p.bio,
      size: 0.16,
      color: PALETTE.textDim,
      maxWidth: 8,
      anchorY: 'top',
    });
    bio.position.set(0, 2.78, 23.75);
    bio.rotation.y = Math.PI;
    wall.add(bio);
  }
  const meta: string[] = [];
  if (p.location) meta.push(p.location);
  if (p.createdAt) meta.push(`on GitHub since ${new Date(p.createdAt).getFullYear()}`);
  if (meta.length) {
    const metaText = makeText({ text: meta.join(' · '), size: 0.13, color: PALETTE.textDim });
    metaText.position.set(0, 2.3, 23.75);
    metaText.rotation.y = Math.PI;
    wall.add(metaText);
  }
  scene.add(wall);
  registry.register(wall, {
    kind: 'profile',
    title: p.name,
    subtitle: `@${p.login}`,
    url: p.htmlUrl,
    focus: { x: 0, z: 19.5, lookX: 0, lookY: 2.8, lookZ: 23.9 },
    ringY: 0.02,
    ringRadius: 1.2,
  });

  interface LinkSpot {
    label: string;
    sub: string;
    url?: string;
    color: string | number;
    body: string;
    repo?: Repo;
  }
  const spots: LinkSpot[] = [
    {
      label: 'GITHUB PROFILE',
      sub: `@${p.login}`,
      url: p.htmlUrl,
      color: PALETTE.cyan,
      body: 'The source of everything in this museum.',
    },
    {
      label: 'MUSEUM SOURCE',
      sub: SITE_REPO,
      url: `https://github.com/${GITHUB_USER}/${SITE_REPO}`,
      color: PALETTE.gold,
      body: 'This museum is itself an exhibit: a static Three.js site, rebuilt daily by GitHub Actions with fresh data.',
    },
  ];
  if (p.blog) {
    const url = p.blog.startsWith('http') ? p.blog : `https://${p.blog}`;
    spots.push({
      label: 'WEBSITE',
      sub: p.blog.replace(/^https?:\/\//, ''),
      url,
      color: '#7ee787',
      body: 'Personal website.',
    });
  }
  const oldest = [...data.repos]
    .filter((r) => !r.isFork && r.createdAt)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];

  const positions: [number, number][] = [
    [-4.2, 17.2],
    [4.2, 17.2],
    [-4.2, 20.8],
    [4.2, 20.8],
  ];
  spots.forEach((spot, i) => {
    if (i >= positions.length) return;
    const [x, z] = positions[i];
    buildLinkPedestal(ctx, spot, x, z);
  });
  if (oldest) {
    const [x, z] = positions[Math.min(spots.length, positions.length - 1)];
    const year = new Date(oldest.createdAt).getFullYear();
    const group = linkPedestalMesh(ctx, 'OLDEST ARTIFACT', `${truncate(oldest.name, 18)} · ${year}`, '#ff9e64', x, z);
    registry.register(group, {
      kind: 'repo',
      title: oldest.name,
      subtitle: `Excavated from ${year} — the oldest public repository in the collection.`,
      url: oldest.htmlUrl,
      repo: oldest,
      focus: { x: x < 0 ? x + 2.3 : x - 2.3, z, lookX: x, lookY: 1.5, lookZ: z },
      ringY: 0.02,
      ringRadius: 0.8,
    });
  }

  function buildLinkPedestal(c: WorldCtx, spot: LinkSpot, x: number, z: number): void {
    const group = linkPedestalMesh(c, spot.label, spot.sub, spot.color, x, z);
    c.registry.register(group, {
      kind: 'link',
      title: spot.label,
      subtitle: spot.sub,
      url: spot.url,
      body: spot.body,
      focus: { x: x < 0 ? x + 2.3 : x - 2.3, z, lookX: x, lookY: 1.5, lookZ: z },
      ringY: 0.02,
      ringRadius: 0.8,
    });
  }

  function linkPedestalMesh(
    c: WorldCtx,
    label: string,
    sub: string,
    color: string | number,
    x: number,
    z: number
  ): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.95, 0.85), mats.pedestal);
    base.position.y = 0.475;
    group.add(base);
    group.add(contactShadow(0.8));
    const icon = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), neonMaterial(color, 1.6));
    icon.position.y = 1.5;
    group.add(icon);
    const faceYaw = x < 0 ? Math.PI / 2 : -Math.PI / 2;
    const labelText = makeText({ text: label, size: 0.11, color: PALETTE.textMain, bold: true, letterSpacing: 0.06 });
    labelText.position.y = 2.12;
    labelText.rotation.y = faceYaw;
    group.add(labelText);
    const subText = makeText({ text: sub, size: 0.085, color: PALETTE.textDim, maxWidth: 1.8 });
    subText.position.y = 1.94;
    subText.rotation.y = faceYaw;
    group.add(subText);
    scene.add(group);
    if (!reducedMotion) {
      const phase = Math.random() * Math.PI * 2;
      updatables.push((dt, e) => {
        icon.rotation.y += dt * 0.7;
        icon.rotation.x += dt * 0.3;
        icon.position.y = 1.5 + Math.sin(e * 1.4 + phase) * 0.05;
      });
    }
    return group;
  }
}
