import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Text } from 'troika-three-text';

import { FONT_BOLD, FONT_REGULAR } from '../config';
import type { ExhibitRegistry } from './exhibits';

export const PALETTE = {
  space: 0x05060f,
  gold: 0xd4af37,
  cyan: 0x4af2ff,
  textMain: '#d6daf0',
  textDim: '#8b93b8',
  textGold: '#e8c861',
};

/** GitHub dark-mode contribution greens, level 0 (empty) through 4. */
export const CONTRIB_COLORS = ['#1a2030', '#0e4429', '#006d32', '#26a641', '#39d353'];

export const ACTIVITY_STYLE: Record<string, { label: string; color: string }> = {
  push: { label: 'PUSH', color: '#4af2ff' },
  pr: { label: 'PULL REQUEST', color: '#a371f7' },
  review: { label: 'REVIEW', color: '#c297ff' },
  issue: { label: 'ISSUE', color: '#3fb950' },
  comment: { label: 'COMMENT', color: '#7ee787' },
  create: { label: 'CREATE', color: '#ffa657' },
  delete: { label: 'DELETE', color: '#f85149' },
  star: { label: 'STAR', color: '#e3b341' },
  fork: { label: 'FORK', color: '#ff7b72' },
  release: { label: 'RELEASE', color: '#db61a2' },
  wiki: { label: 'WIKI', color: '#79c0ff' },
  public: { label: 'PUBLIC', color: '#56d364' },
};

export type Updatable = (dt: number, elapsed: number) => void;

export interface Mats {
  floor: THREE.MeshStandardMaterial;
  floorAlt: THREE.MeshStandardMaterial;
  wall: THREE.MeshStandardMaterial;
  column: THREE.MeshStandardMaterial;
  trimGold: THREE.MeshStandardMaterial;
  trimCyan: THREE.MeshStandardMaterial;
  pedestal: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
}

export interface WorldCtx {
  scene: THREE.Scene;
  mats: Mats;
  registry: ExhibitRegistry;
  updatables: Updatable[];
  reducedMotion: boolean;
}

let marbleTex: THREE.CanvasTexture | null = null;

/** Procedural dark marble: blotches plus a few pale veins on a near-black base. */
export function marbleTexture(): THREE.CanvasTexture {
  if (marbleTex) return marbleTex;
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#181b2e';
  g.fillRect(0, 0, size, size);

  for (let i = 0; i < 26; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 40 + Math.random() * 130;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    const tone = Math.random() > 0.5 ? '255, 255, 255' : '40, 60, 130';
    grad.addColorStop(0, `rgba(${tone}, 0.045)`);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
  }

  for (let i = 0; i < 22; i++) {
    g.strokeStyle = `rgba(170, 185, 235, ${0.04 + Math.random() * 0.07})`;
    g.lineWidth = 0.6 + Math.random() * 1.4;
    g.beginPath();
    let x = Math.random() * size;
    let y = Math.random() * size;
    g.moveTo(x, y);
    const steps = 4 + Math.floor(Math.random() * 4);
    for (let s = 0; s < steps; s++) {
      const nx = x + (Math.random() - 0.5) * 220;
      const ny = y + (Math.random() - 0.5) * 220;
      g.quadraticCurveTo(
        x + (Math.random() - 0.5) * 90,
        y + (Math.random() - 0.5) * 90,
        nx,
        ny
      );
      x = nx;
      y = ny;
    }
    g.stroke();
  }

  marbleTex = new THREE.CanvasTexture(canvas);
  marbleTex.wrapS = THREE.RepeatWrapping;
  marbleTex.wrapT = THREE.RepeatWrapping;
  marbleTex.repeat.set(3, 3);
  marbleTex.colorSpace = THREE.SRGBColorSpace;
  return marbleTex;
}

let radialTex: THREE.CanvasTexture | null = null;

/** Soft radial falloff used for fake contact shadows and glow sprites. */
export function radialTexture(): THREE.CanvasTexture {
  if (radialTex) return radialTex;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d')!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.55, 'rgba(255, 255, 255, 0.35)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  radialTex = new THREE.CanvasTexture(canvas);
  return radialTex;
}

export function createMaterials(): Mats {
  const marble = marbleTexture();
  return {
    floor: new THREE.MeshStandardMaterial({
      map: marble,
      color: 0xffffff,
      roughness: 0.42,
      metalness: 0.22,
      envMapIntensity: 0.9,
    }),
    floorAlt: new THREE.MeshStandardMaterial({
      map: marble,
      color: 0x8c93b8,
      roughness: 0.5,
      metalness: 0.18,
      envMapIntensity: 0.7,
    }),
    wall: new THREE.MeshStandardMaterial({
      color: 0x222742,
      roughness: 0.85,
      metalness: 0.05,
      side: THREE.DoubleSide,
    }),
    column: new THREE.MeshStandardMaterial({ color: 0x2c3155, roughness: 0.55, metalness: 0.15 }),
    trimGold: new THREE.MeshStandardMaterial({
      color: 0x44390f,
      emissive: PALETTE.gold,
      emissiveIntensity: 0.55,
      roughness: 0.4,
      metalness: 0.8,
      side: THREE.DoubleSide, // trim bands include open cylinders seen from inside
    }),
    trimCyan: new THREE.MeshStandardMaterial({
      color: 0x07232b,
      emissive: PALETTE.cyan,
      emissiveIntensity: 1.4,
      roughness: 0.35,
      metalness: 0.1,
      side: THREE.DoubleSide,
    }),
    pedestal: new THREE.MeshStandardMaterial({ color: 0x262b4c, roughness: 0.5, metalness: 0.25 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x0b0d18, roughness: 0.9, metalness: 0 }),
  };
}

export function neonMaterial(color: string | number, intensity = 2): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0x0a0b14,
    emissive: new THREE.Color(color),
    emissiveIntensity: intensity,
    roughness: 0.35,
    metalness: 0.1,
  });
}

export interface TextOpts {
  text: string;
  size?: number;
  color?: string | number;
  bold?: boolean;
  anchorX?: 'left' | 'center' | 'right';
  anchorY?: 'top' | 'middle' | 'bottom';
  maxWidth?: number;
  align?: 'left' | 'center' | 'right';
  lineHeight?: number;
  letterSpacing?: number;
}

export function makeText(opts: TextOpts): Text {
  const t = new Text();
  t.text = opts.text;
  t.font = opts.bold ? FONT_BOLD : FONT_REGULAR;
  t.fontSize = opts.size ?? 0.18;
  t.color = opts.color ?? PALETTE.textMain;
  t.anchorX = opts.anchorX ?? 'center';
  t.anchorY = opts.anchorY ?? 'middle';
  if (opts.maxWidth !== undefined) t.maxWidth = opts.maxWidth;
  t.textAlign = opts.align ?? 'center';
  if (opts.lineHeight !== undefined) t.lineHeight = opts.lineHeight;
  if (opts.letterSpacing !== undefined) t.letterSpacing = opts.letterSpacing;
  t.sync();
  return t;
}

/** Dark soft circle that grounds objects without real shadow maps. */
export function contactShadow(radius: number): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 24),
    new THREE.MeshBasicMaterial({
      map: radialTexture(),
      color: 0x000000,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.015;
  mesh.renderOrder = 1;
  return mesh;
}

/**
 * Collects geometry into per-material buckets and merges each bucket into a
 * single mesh, keeping the draw-call count of all static architecture low.
 */
export class GeometryBatcher {
  private buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  private readonly tmpMatrix = new THREE.Matrix4();
  private readonly tmpQuat = new THREE.Quaternion();
  private readonly tmpEuler = new THREE.Euler();
  private readonly one = new THREE.Vector3(1, 1, 1);

  add(geometry: THREE.BufferGeometry, material: THREE.Material, matrix?: THREE.Matrix4): void {
    const g = matrix ? geometry.clone().applyMatrix4(matrix) : geometry;
    const list = this.buckets.get(material);
    if (list) list.push(g);
    else this.buckets.set(material, [g]);
  }

  place(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    rotY = 0
  ): void {
    this.tmpQuat.setFromEuler(this.tmpEuler.set(0, rotY, 0));
    this.tmpMatrix.compose(new THREE.Vector3(x, y, z), this.tmpQuat, this.one);
    this.add(geometry, material, this.tmpMatrix);
  }

  box(
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    material: THREE.Material,
    rotY = 0
  ): void {
    this.place(new THREE.BoxGeometry(w, h, d), material, x, y, z, rotY);
  }

  cylinder(
    rTop: number,
    rBottom: number,
    h: number,
    segments: number,
    x: number,
    y: number,
    z: number,
    material: THREE.Material
  ): void {
    this.place(new THREE.CylinderGeometry(rTop, rBottom, h, segments), material, x, y, z);
  }

  flush(scene: THREE.Scene): void {
    for (const [material, geometries] of this.buckets) {
      const merged = mergeGeometries(geometries, false);
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, material);
      mesh.matrixAutoUpdate = false;
      scene.add(mesh);
      for (const g of geometries) g.dispose();
    }
    this.buckets.clear();
  }
}
