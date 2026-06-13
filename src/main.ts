import './style.css';

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

import { MuseumAudio } from './audio';
import { PlayerControls } from './controls';
import { loadGithubData } from './data';
import { openListView } from './listview';
import { Minimap } from './minimap';
import { Picker } from './picker';
import { createUI } from './ui';
import type { GithubData } from './github/types';
import type { Exhibit } from './world/exhibits';
import { buildWorld } from './world';
import { ROOM_ANCHORS } from './world/layout';

function supportsWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}

const isTouch = (): boolean =>
  window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

async function boot(): Promise<void> {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch = isTouch();
  let quality = !touch;
  let userSetQuality = false;
  let entered = false;

  const audio = new MuseumAudio();
  const ui = createUI({
    onEnter: () => enter(),
    onTeleport: (roomId) => teleport(roomId),
    onOpenList: () => openListView(data, true),
    onToggleQuality: () => {
      userSetQuality = true;
      setQuality(!quality);
      return quality;
    },
    onToggleSound: () => audio.toggle(),
  });
  ui.setTouch(touch);
  ui.setSoundLabel(audio.isMuted);

  ui.setLoading('Contacting GitHub…');
  let data: GithubData;
  try {
    data = await loadGithubData();
  } catch (err) {
    console.error(err);
    ui.showError('Could not load the museum data');
    return;
  }
  document.title = `${data.profile.name} — Palace of Nerdy Collections`;

  if (!supportsWebGL()) {
    ui.hideIntro();
    openListView(data, false);
    return;
  }

  ui.setLoading('Constructing the museum…');
  // Let the status line paint before the synchronous world build.
  await new Promise((r) => requestAnimationFrame(r));

  const app = document.getElementById('app')!;
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  app.appendChild(renderer.domElement);

  const world = buildWorld(renderer, data, reducedMotion);
  const camera = new THREE.PerspectiveCamera(
    72,
    window.innerWidth / window.innerHeight,
    0.1,
    700
  );

  const controls = new PlayerControls(camera, renderer.domElement, world.walkable, {
    touch,
    reducedMotion,
    onTap: (x, y) => {
      const ex = picker.pickAtScreen(x, y);
      picker.setHovered(ex);
      if (ex) select(ex);
    },
    onLockChange: (locked) => ui.setLockState(locked),
    onLockError: () => {
      ui.setDragMode(true);
      ui.toast('Pointer lock unavailable here — drag to look, WASD to walk');
    },
  });
  controls.teleport(0, 7, 0);

  const minimap = new Minimap((roomId) => teleport(roomId));

  const picker = new Picker(
    world.scene,
    camera,
    world.registry,
    world.calendar,
    renderer.domElement,
    (ex) => onHover(ex)
  );

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(world.scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.55,
    0.4,
    0.85
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  function setQuality(high: boolean): void {
    quality = high;
    bloom.enabled = high;
    const ratio = Math.min(window.devicePixelRatio, high ? 2 : 1.25);
    renderer.setPixelRatio(ratio);
    composer.setPixelRatio(ratio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    ui.setQualityLabel(high);
  }
  setQuality(quality);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
  });

  function onHover(ex: Exhibit | null): void {
    renderer.domElement.style.cursor = ex && !controls.locked ? 'pointer' : '';
    if (!ex) {
      ui.tooltip.hide();
      return;
    }
    if (entered) audio.hover();
    const sub = ex.kind === 'repo' ? ex.subtitle : (ex.subtitle ?? kindHint(ex));
    ui.tooltip.show(ex.title, sub, lastPointer.x, lastPointer.y, controls.locked);
  }

  const kindHint = (ex: Exhibit): string | undefined =>
    ({ stat: 'click to inspect', info: 'click to read', link: 'click to open' })[
      ex.kind as 'stat' | 'info' | 'link'
    ];

  const lastPointer = { x: 0, y: 0 };
  renderer.domElement.addEventListener('pointermove', (e) => {
    lastPointer.x = e.clientX;
    lastPointer.y = e.clientY;
    if (picker.hovered && !controls.locked && !touch) {
      const ex = picker.hovered;
      ui.tooltip.show(ex.title, ex.subtitle, e.clientX, e.clientY, false);
    }
  });

  function select(ex: Exhibit): void {
    if (!touch && controls.locked) document.exitPointerLock();
    audio.select();
    ui.panel.open(ex);
    controls.glideTo(ex.focus);
  }

  renderer.domElement.addEventListener('click', () => {
    if (touch || !entered) return;
    if (controls.wasDragging()) return; // a look-drag is not a click
    const ex = picker.hovered;
    if (controls.locked) {
      if (ex) select(ex);
    } else if (ex) {
      select(ex);
    } else {
      ui.panel.close();
      controls.requestLock();
    }
  });

  function enter(): void {
    entered = true;
    controls.enabled = true;
    audio.start();
    ui.hideIntro();
    minimap.setVisible(true);
    controls.flyIn();
    if (!touch) controls.requestLock();
  }

  function teleport(roomId: string): void {
    const anchor = ROOM_ANCHORS.find((a) => a.id === roomId);
    if (!anchor || !entered) return;
    ui.panel.close();
    audio.whoosh();
    ui.fade(() => controls.teleport(anchor.x, anchor.z, anchor.yaw));
  }

  document.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (!entered) return;
    const anchor = ROOM_ANCHORS.find((a) => a.key === e.key);
    if (anchor) teleport(anchor.id);
    else if (e.code === 'KeyH') ui.toggleHelp();
    else if (e.code === 'KeyL') openListView(data, true);
    else if (e.code === 'KeyM') ui.setSoundLabel(audio.toggle());
  });

  // Render loop with a lightweight auto-quality monitor.
  let last = performance.now();
  let elapsed = 0;
  let perfTime = 0;
  let perfFrames = 0;
  renderer.setAnimationLoop(() => {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    elapsed += dt;
    controls.update(dt);
    picker.update(controls.locked, touch, elapsed);
    for (const update of world.updatables) update(dt, elapsed);
    minimap.update(controls.pos.x, controls.pos.z, controls.yaw);

    // A touch of extra FOV while sprinting.
    const targetFov = controls.isSprinting && !reducedMotion ? 78 : 72;
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 5);
      camera.updateProjectionMatrix();
    }

    composer.render();

    if (quality && !userSetQuality) {
      perfTime += dt;
      perfFrames++;
      if (perfTime > 4) {
        if (perfFrames / perfTime < 32) {
          setQuality(false);
          ui.toast('Performance mode enabled (FX off) — toggle FX in the top bar');
        }
        perfTime = 0;
        perfFrames = 0;
      }
    }
  });

  const exhibitCount = world.registry.pickables.length + (world.calendar?.days.length ?? 0);
  ui.setReady(`Museum ready — ${exhibitCount.toLocaleString('en-US')} exhibits on display`);

  if (import.meta.env.DEV) {
    // Dev-only hook for driving the camera from the console / E2E checks.
    (window as unknown as Record<string, unknown>).__museum = {
      controls,
      camera,
      world,
      enter,
      teleport,
      select,
      picker,
    };
  }
}

void boot();
