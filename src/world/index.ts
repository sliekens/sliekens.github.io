import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import type { GithubData } from '../github/types';
import { buildArchitecture, buildLights, buildSky } from './architecture';
import { PALETTE, createMaterials, type Updatable, type WorldCtx } from './core';
import { ExhibitRegistry } from './exhibits';
import { WalkableMap, createWalkableMap } from './layout';
import {
  buildAbout,
  buildEntrance,
  buildGallery,
  buildGarden,
  buildTimeline,
  type CalendarPick,
} from './rooms';

export interface World {
  scene: THREE.Scene;
  registry: ExhibitRegistry;
  walkable: WalkableMap;
  updatables: Updatable[];
  calendar: CalendarPick | null;
}

export function buildWorld(
  renderer: THREE.WebGLRenderer,
  data: GithubData,
  reducedMotion: boolean
): World {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.space);
  scene.fog = new THREE.Fog(PALETTE.space, 30, 150);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.45;
  pmrem.dispose();

  const ctx: WorldCtx = {
    scene,
    mats: createMaterials(),
    registry: new ExhibitRegistry(),
    updatables: [],
    reducedMotion,
  };

  buildSky(ctx);
  buildLights(scene);
  buildArchitecture(ctx);
  buildEntrance(ctx, data);
  buildGallery(ctx, data);
  const calendar = buildGarden(ctx, data);
  buildTimeline(ctx, data);
  buildAbout(ctx, data);

  return {
    scene,
    registry: ctx.registry,
    walkable: createWalkableMap(),
    updatables: ctx.updatables,
    calendar,
  };
}
