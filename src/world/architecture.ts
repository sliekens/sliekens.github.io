import * as THREE from 'three';

import {
  GeometryBatcher,
  PALETTE,
  makeText,
  neonMaterial,
  radialTexture,
  type Mats,
  type WorldCtx,
} from './core';
import { CORRIDORS, GARDEN_PIT, ROOMS } from './layout';

const WALL_T = 0.35;
const ROTUNDA_WALL_R = 12.15;
const ROTUNDA_WALL_H = 6;
/** Half-angle of each rotunda doorway, in radians. */
const DOOR_HALF = 0.29;

export function buildSky(ctx: WorldCtx): void {
  const { scene, updatables } = ctx;

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(280, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vPos;
        void main() {
          float h = normalize(vPos).y * 0.5 + 0.5;
          vec3 deep = vec3(0.012, 0.013, 0.045);
          vec3 zenith = vec3(0.07, 0.04, 0.14);
          vec3 col = mix(deep, zenith, pow(h, 1.4));
          col += vec3(0.05, 0.13, 0.17) * pow(1.0 - abs(h - 0.5) * 2.0, 6.0) * 0.4;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    })
  );
  scene.add(sky);

  const starCount = 1600;
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);
  const tints = [new THREE.Color(0xffffff), new THREE.Color(0xaee8ff), new THREE.Color(0xffe2b8)];
  for (let i = 0; i < starCount; i++) {
    const r = 235 + Math.random() * 35;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi);
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    const tint = tints[Math.floor(Math.random() * tints.length)];
    const dim = 0.5 + Math.random() * 0.5;
    colors[i * 3] = tint.r * dim;
    colors[i * 3 + 1] = tint.g * dim;
    colors[i * 3 + 2] = tint.b * dim;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({
      size: 1.4,
      map: radialTexture(),
      alphaTest: 0.02,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      fog: false,
    })
  );
  scene.add(stars);
  updatables.push((dt) => {
    stars.rotation.y += dt * 0.004;
  });

  // A dark deck far below catches any sightline that slips past the floors.
  const voidDisc = new THREE.Mesh(
    new THREE.CircleGeometry(120, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x030409 })
  );
  voidDisc.position.y = -1.5;
  scene.add(voidDisc);
}

export function buildLights(scene: THREE.Scene): void {
  scene.add(new THREE.AmbientLight(0x42496e, 0.7));
  scene.add(new THREE.HemisphereLight(0x5a6494, 0x10121f, 0.7));

  const points: [number, number, number, number, number][] = [
    // x, y, z, color, intensity
    [0, 7, 0, 0xffd9a3, 70],
    [0, 16, 0, 0x4af2ff, 40],
    [0, 5, -23, 0xbfd0ff, 55],
    [0, 5, -37, 0xbfd0ff, 55],
    [-29, 4.8, 0, 0x8fffba, 45],
    [31, 3, 0, 0xffe2b0, 30],
    [0, 4.1, 19, 0xffd9a3, 22],
  ];
  for (const [x, y, z, color, intensity] of points) {
    const light = new THREE.PointLight(color, intensity, 0, 2);
    light.position.set(x, y, z);
    scene.add(light);
  }
}

function wallSegment(
  b: GeometryBatcher,
  mats: Mats,
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  h: number
): void {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const len = Math.hypot(dx, dz);
  const cx = (x1 + x2) / 2;
  const cz = (z1 + z2) / 2;
  const rotY = Math.atan2(-dz, dx);
  b.box(len, h, WALL_T, cx, h / 2, cz, mats.wall, rotY);
  b.box(len, 0.12, WALL_T + 0.08, cx, 0.06, cz, mats.trimGold, rotY);
  b.box(len, 0.07, WALL_T + 0.06, cx, h - 0.1, cz, mats.trimCyan, rotY);
}

function column(b: GeometryBatcher, mats: Mats, x: number, z: number, h: number): void {
  b.box(0.95, 0.22, 0.95, x, 0.11, z, mats.column);
  b.cylinder(0.27, 0.33, h - 0.42, 10, x, 0.22 + (h - 0.42) / 2, z, mats.column);
  b.box(0.85, 0.2, 0.85, x, h - 0.1, z, mats.column);
}

function portal(b: GeometryBatcher, mats: Mats, x: number, z: number, rotY: number): void {
  for (const side of [-3.3, 3.3]) {
    const px = x + Math.cos(rotY) * side;
    const pz = z - Math.sin(rotY) * side;
    b.box(0.55, 3.7, 0.55, px, 1.85, pz, mats.column, rotY);
  }
  b.box(7.4, 0.55, 0.7, x, 3.95, z, mats.column, rotY);
  b.box(6.6, 0.1, 0.18, x, 3.62, z, mats.trimCyan, rotY);
}

function floorPlane(
  b: GeometryBatcher,
  mat: THREE.Material,
  x1: number,
  x2: number,
  z1: number,
  z2: number,
  y = 0
): void {
  const geo = new THREE.PlaneGeometry(x2 - x1, z2 - z1).rotateX(-Math.PI / 2);
  b.place(geo, mat, (x1 + x2) / 2, y, (z1 + z2) / 2);
}

function ceilingPlane(
  b: GeometryBatcher,
  mat: THREE.Material,
  x1: number,
  x2: number,
  z1: number,
  z2: number,
  y: number
): void {
  const geo = new THREE.PlaneGeometry(x2 - x1, z2 - z1).rotateX(Math.PI / 2);
  b.place(geo, mat, (x1 + x2) / 2, y, (z1 + z2) / 2);
}

/** Garden floor is the room rectangle with the heatmap pit cut out. */
function gardenFloor(b: GeometryBatcher, mat: THREE.Material): void {
  const g = ROOMS.garden;
  const p = GARDEN_PIT;
  const shape = new THREE.Shape();
  shape.moveTo(g.x1, -g.z1);
  shape.lineTo(g.x2, -g.z1);
  shape.lineTo(g.x2, -g.z2);
  shape.lineTo(g.x1, -g.z2);
  shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(p.x1, -p.z1);
  hole.lineTo(p.x1, -p.z2);
  hole.lineTo(p.x2, -p.z2);
  hole.lineTo(p.x2, -p.z1);
  hole.closePath();
  shape.holes.push(hole);
  const geo = new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2);
  b.place(geo, mat, 0, 0, 0);
}

function gardenPit(b: GeometryBatcher, mats: Mats, rim: THREE.Material): void {
  const p = GARDEN_PIT;
  const w = p.x2 - p.x1;
  const d = p.z2 - p.z1;
  const cx = (p.x1 + p.x2) / 2;
  const cz = (p.z1 + p.z2) / 2;

  floorPlane(b, mats.dark, p.x1, p.x2, p.z1, p.z2, -p.depth);
  // Pit walls
  b.box(w + 0.24, p.depth, 0.12, cx, -p.depth / 2, p.z1 - 0.06, mats.dark);
  b.box(w + 0.24, p.depth, 0.12, cx, -p.depth / 2, p.z2 + 0.06, mats.dark);
  b.box(0.12, p.depth, d, p.x1 - 0.06, -p.depth / 2, cz, mats.dark);
  b.box(0.12, p.depth, d, p.x2 + 0.06, -p.depth / 2, cz, mats.dark);
  // Glowing rim
  b.box(w + 0.5, 0.05, 0.14, cx, 0.025, p.z1 - 0.12, rim);
  b.box(w + 0.5, 0.05, 0.14, cx, 0.025, p.z2 + 0.12, rim);
  b.box(0.14, 0.05, d + 0.5, p.x1 - 0.12, 0.025, cz, rim);
  b.box(0.14, 0.05, d + 0.5, p.x2 + 0.12, 0.025, cz, rim);

  // Railing: posts plus a double gold rail, offset half a meter from the rim.
  const off = 0.5;
  const postGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.9, 6);
  const rail = (x1: number, z1: number, x2: number, z2: number): void => {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const rotY = Math.atan2(-(z2 - z1), x2 - x1);
    const rx = (x1 + x2) / 2;
    const rz = (z1 + z2) / 2;
    b.box(len, 0.045, 0.045, rx, 0.88, rz, mats.trimGold, rotY);
    b.box(len, 0.035, 0.035, rx, 0.5, rz, mats.trimGold, rotY);
    const posts = Math.max(2, Math.round(len / 2.3) + 1);
    for (let i = 0; i < posts; i++) {
      const t = i / (posts - 1);
      b.place(postGeo, mats.column, x1 + (x2 - x1) * t, 0.45, z1 + (z2 - z1) * t);
    }
  };
  rail(p.x1 - off, p.z1 - off, p.x2 + off, p.z1 - off);
  rail(p.x1 - off, p.z2 + off, p.x2 + off, p.z2 + off);
  rail(p.x1 - off, p.z1 - off, p.x1 - off, p.z2 + off);
  rail(p.x2 + off, p.z1 - off, p.x2 + off, p.z2 + off);
}

export function buildArchitecture(ctx: WorldCtx): void {
  const { scene, mats, updatables } = ctx;
  const b = new GeometryBatcher();
  const skylightGreen = neonMaterial('#2bd853', 0.55);
  const skylightCyan = neonMaterial('#4af2ff', 0.6);
  const rimGreen = neonMaterial('#2bd853', 0.8);

  // ---- Rotunda ----
  b.place(new THREE.CircleGeometry(12.45, 64).rotateX(-Math.PI / 2), mats.floor, 0, 0.002, 0);
  b.place(new THREE.CircleGeometry(3.6, 48).rotateX(-Math.PI / 2), mats.floorAlt, 0, 0.012, 0);
  b.place(new THREE.RingGeometry(3.7, 3.95, 48).rotateX(-Math.PI / 2), mats.trimGold, 0, 0.015, 0);
  b.place(new THREE.RingGeometry(10.6, 10.78, 64).rotateX(-Math.PI / 2), mats.trimCyan, 0, 0.015, 0);

  // Four wall arcs between the doorways. Cylinder param: x = r·sinθ, z = r·cosθ;
  // doors point along +z (about), +x (timeline), -z (gallery), -x (garden).
  for (let i = 0; i < 4; i++) {
    const start = i * (Math.PI / 2) + DOOR_HALF;
    const length = Math.PI / 2 - DOOR_HALF * 2;
    b.place(
      new THREE.CylinderGeometry(ROTUNDA_WALL_R, ROTUNDA_WALL_R, ROTUNDA_WALL_H, 24, 1, true, start, length),
      mats.wall,
      0,
      ROTUNDA_WALL_H / 2,
      0
    );
    b.place(
      new THREE.CylinderGeometry(ROTUNDA_WALL_R + 0.04, ROTUNDA_WALL_R + 0.04, 0.1, 24, 1, true, start, length),
      mats.trimGold,
      0,
      0.08,
      0
    );
    b.place(
      new THREE.CylinderGeometry(ROTUNDA_WALL_R + 0.04, ROTUNDA_WALL_R + 0.04, 0.08, 24, 1, true, start, length),
      mats.trimCyan,
      0,
      ROTUNDA_WALL_H - 0.12,
      0
    );
  }

  // Columns between doorways (two per quadrant).
  for (let i = 0; i < 8; i++) {
    const theta = Math.PI / 8 + i * (Math.PI / 4);
    column(b, mats, 10.6 * Math.sin(theta), 10.6 * Math.cos(theta), 5.6);
  }

  portal(b, mats, 0, -11.8, 0);
  portal(b, mats, 0, 11.8, 0);
  portal(b, mats, 11.8, 0, Math.PI / 2);
  portal(b, mats, -11.8, 0, Math.PI / 2);

  // ---- Corridors ----
  floorPlane(b, mats.floorAlt, -3, 3, -16, -10.5);
  floorPlane(b, mats.floorAlt, -3, 3, 10.5, 14);
  floorPlane(b, mats.floorAlt, 10.5, 16, -3, 3);
  floorPlane(b, mats.floorAlt, -16, -10.5, -3, 3);
  for (const [x1, z1, x2, z2] of [
    [-3, -16, -3, -11.9],
    [3, -16, 3, -11.9],
    [-3, 11.9, -3, 14],
    [3, 11.9, 3, 14],
    [11.9, -3, 16, -3],
    [11.9, 3, 16, 3],
    [-16, -3, -11.9, -3],
    [-16, 3, -11.9, 3],
  ] as const) {
    wallSegment(b, mats, x1, z1, x2, z2, 3.6);
  }
  ceilingPlane(b, mats.wall, -3, 3, -16.2, -11.5, 3.6);
  ceilingPlane(b, mats.wall, -3, 3, 11.5, 16.2, 3.6);
  ceilingPlane(b, mats.wall, 11.5, 16.2, -3, 3, 3.6);
  ceilingPlane(b, mats.wall, -16.2, -11.5, -3, 3, 3.6);
  b.box(0.18, 0.06, 4.5, 0, 3.52, -13.75, mats.trimCyan);
  b.box(0.18, 0.06, 4.5, 0, 3.52, 13.75, mats.trimCyan);
  b.box(4.5, 0.06, 0.18, 13.75, 3.52, 0, mats.trimCyan);
  b.box(4.5, 0.06, 0.18, -13.75, 3.52, 0, mats.trimCyan);

  // ---- Repository Gallery (north) ----
  const ga = ROOMS.gallery;
  floorPlane(b, mats.floor, ga.x1, ga.x2, ga.z1, ga.z2);
  wallSegment(b, mats, ga.x1, ga.z2, -3, ga.z2, 5.5);
  wallSegment(b, mats, 3, ga.z2, ga.x2, ga.z2, 5.5);
  wallSegment(b, mats, ga.x1, ga.z1, ga.x2, ga.z1, 5.5);
  wallSegment(b, mats, ga.x1, ga.z2, ga.x1, ga.z1, 5.5);
  wallSegment(b, mats, ga.x2, ga.z2, ga.x2, ga.z1, 5.5);
  for (const z of [-21, -27, -33, -39, -45]) {
    column(b, mats, -7.3, z, 5.5);
    column(b, mats, 7.3, z, 5.5);
  }
  ceilingPlane(b, mats.wall, ga.x1, ga.x2, ga.z1, ga.z2, 5.5);
  for (const z of [-22, -31, -40]) {
    b.box(12, 0.08, 1.3, 0, 5.43, z, skylightCyan);
  }

  // ---- Contribution Garden (west) ----
  const gd = ROOMS.garden;
  gardenFloor(b, mats.floor);
  gardenPit(b, mats, rimGreen);
  wallSegment(b, mats, gd.x2, gd.z1, gd.x2, -3, 5.5);
  wallSegment(b, mats, gd.x2, 3, gd.x2, gd.z2, 5.5);
  wallSegment(b, mats, gd.x1, gd.z1, gd.x1, gd.z2, 5.5);
  wallSegment(b, mats, gd.x1, gd.z1, gd.x2, gd.z1, 5.5);
  wallSegment(b, mats, gd.x1, gd.z2, gd.x2, gd.z2, 5.5);
  for (const [x, z] of [
    [-41.2, -12.2],
    [-41.2, 12.2],
    [-16.8, -12.2],
    [-16.8, 12.2],
    [-29, -12.2],
    [-29, 12.2],
  ] as const) {
    column(b, mats, x, z, 5.5);
  }
  ceilingPlane(b, mats.wall, gd.x1, gd.x2, gd.z1, gd.z2, 6);
  b.box(20, 0.08, 1.1, -29, 5.93, -5.5, skylightGreen);
  b.box(20, 0.08, 1.1, -29, 5.93, 5.5, skylightGreen);

  // ---- Activity Timeline (east) ----
  const tl = ROOMS.timeline;
  floorPlane(b, mats.floor, tl.x1, tl.x2, tl.z1, tl.z2);
  wallSegment(b, mats, tl.x1, tl.z1, tl.x1, -3, 4);
  wallSegment(b, mats, tl.x1, 3, tl.x1, tl.z2, 4);
  wallSegment(b, mats, tl.x2, tl.z1, tl.x2, tl.z2, 4);
  wallSegment(b, mats, tl.x1, tl.z1, tl.x2, tl.z1, 4);
  wallSegment(b, mats, tl.x1, tl.z2, tl.x2, tl.z2, 4);
  ceilingPlane(b, mats.wall, tl.x1, tl.x2, tl.z1, tl.z2, 3.8);
  const stripGold = neonMaterial('#d4af37', 0.35);
  b.box(28, 0.06, 0.35, 31, 3.72, 0, stripGold);
  b.box(26, 0.04, 0.16, 31.5, 0.02, 0, stripGold);

  // ---- About (south) ----
  const ab = ROOMS.about;
  floorPlane(b, mats.floor, ab.x1, ab.x2, ab.z1, ab.z2);
  wallSegment(b, mats, ab.x1, ab.z1, -3, ab.z1, 4.5);
  wallSegment(b, mats, 3, ab.z1, ab.x2, ab.z1, 4.5);
  wallSegment(b, mats, ab.x1, ab.z2, ab.x2, ab.z2, 4.5);
  wallSegment(b, mats, ab.x1, ab.z1, ab.x1, ab.z2, 4.5);
  wallSegment(b, mats, ab.x2, ab.z1, ab.x2, ab.z2, 4.5);
  column(b, mats, -5.3, 23.3, 4.5);
  column(b, mats, 5.3, 23.3, 4.5);
  ceilingPlane(b, mats.wall, ab.x1, ab.x2, ab.z1, ab.z2, 4.5);
  b.box(8, 0.06, 0.6, 0, 4.42, 19, stripGold);

  b.flush(scene);

  // ---- Non-batched pieces ----
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(12.4, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2.15),
    new THREE.MeshBasicMaterial({ color: 0x35406e, wireframe: true, transparent: true, opacity: 0.5 })
  );
  dome.position.y = ROTUNDA_WALL_H - 0.1;
  scene.add(dome);

  const apex = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: radialTexture(),
      color: PALETTE.cyan,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  apex.scale.setScalar(5);
  apex.position.set(0, 16.5, 0);
  scene.add(apex);

  // Doorway signage, facing the center of the rotunda.
  const signs: [string, number, number, number][] = [
    ['REPOSITORY GALLERY', 0, -10.9, 0],
    ['ACTIVITY TIMELINE', 10.9, 0, -Math.PI / 2],
    ['CONTRIBUTION GARDEN', -10.9, 0, Math.PI / 2],
    ['ABOUT THE CURATOR', 0, 10.9, Math.PI],
  ];
  for (const [label, x, z, rotY] of signs) {
    const t = makeText({
      text: label,
      size: 0.34,
      color: PALETTE.textGold,
      bold: true,
      letterSpacing: 0.08,
    });
    t.position.set(x, 4.45, z);
    t.rotation.y = rotY;
    scene.add(t);
  }

  const title = makeText({
    text: 'PALACE OF NERDY COLLECTIONS',
    size: 0.42,
    color: PALETTE.textGold,
    bold: true,
    letterSpacing: 0.12,
  });
  title.position.set(0, 5.1, -3);
  scene.add(title);

  // Slow drifting dust motes in the rotunda.
  const moteCount = 130;
  const motePos = new Float32Array(moteCount * 3);
  for (let i = 0; i < moteCount; i++) {
    const r = Math.sqrt(Math.random()) * 10.5;
    const a = Math.random() * Math.PI * 2;
    motePos[i * 3] = r * Math.cos(a);
    motePos[i * 3 + 1] = 0.3 + Math.random() * 5.2;
    motePos[i * 3 + 2] = r * Math.sin(a);
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  const motes = new THREE.Points(
    moteGeo,
    new THREE.PointsMaterial({
      size: 0.045,
      map: radialTexture(),
      color: 0x7fd9ff,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  scene.add(motes);
  if (!ctx.reducedMotion) {
    updatables.push((dt) => {
      const arr = moteGeo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < moteCount; i++) {
        let y = arr.getY(i) + dt * 0.12;
        if (y > 5.8) y = 0.3;
        arr.setY(i, y);
      }
      arr.needsUpdate = true;
    });
  }
}
