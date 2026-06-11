import * as THREE from 'three';

import type { Exhibit, ExhibitRegistry } from './world/exhibits';
import { GARDEN_PIT } from './world/layout';
import type { CalendarPick } from './world/rooms';

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/**
 * Raycast-based exhibit picking: cursor position when the mouse is free,
 * screen center when pointer-locked, tap position on touch. A pulsing
 * ring on the floor marks whatever is currently hovered.
 */
export class Picker {
  hovered: Exhibit | null = null;

  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly ndc = new THREE.Vector2();
  private pointerActive = false;
  private readonly ring: THREE.Mesh;
  private readonly dayCache = new Map<number, Exhibit>();
  private frame = 0;

  constructor(
    scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly registry: ExhibitRegistry,
    private readonly calendar: CalendarPick | null,
    dom: HTMLElement,
    private readonly onHover?: (ex: Exhibit | null) => void
  ) {
    this.raycaster.far = 70;
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.86, 1, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: 0x4af2ff,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    this.ring.visible = false;
    this.ring.renderOrder = 2;
    scene.add(this.ring);

    dom.addEventListener('pointermove', (e) => {
      this.pointer.set(
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1
      );
      this.pointerActive = true;
    });
  }

  pickAtScreen(clientX: number, clientY: number): Exhibit | null {
    return this.pickNDC(
      (clientX / window.innerWidth) * 2 - 1,
      -(clientY / window.innerHeight) * 2 + 1
    );
  }

  update(locked: boolean, touch: boolean, elapsed: number): void {
    this.frame++;
    if (this.frame % 2 === 0 && !touch) {
      let ex: Exhibit | null = null;
      if (locked) ex = this.pickNDC(0, 0);
      else if (this.pointerActive) ex = this.pickNDC(this.pointer.x, this.pointer.y);
      if (ex?.id !== this.hovered?.id) {
        this.hovered = ex;
        this.onHover?.(ex);
      }
    }

    const ex = this.hovered;
    if (ex) {
      this.ring.visible = true;
      this.ring.position.set(ex.focus.lookX, ex.ringY ?? 0.02, ex.focus.lookZ);
      const pulse = 1 + Math.sin(elapsed * 4) * 0.05;
      this.ring.scale.setScalar((ex.ringRadius ?? 1) * pulse);
    } else {
      this.ring.visible = false;
    }
  }

  /** Used by touch taps, where there is no persistent hover. */
  setHovered(ex: Exhibit | null): void {
    if (ex?.id !== this.hovered?.id) {
      this.hovered = ex;
      this.onHover?.(ex);
    }
  }

  private pickNDC(nx: number, ny: number): Exhibit | null {
    this.raycaster.setFromCamera(this.ndc.set(nx, ny), this.camera);
    const targets: THREE.Object3D[] = this.calendar
      ? [...this.registry.pickables, this.calendar.mesh]
      : [...this.registry.pickables];
    const hits = this.raycaster.intersectObjects(targets, true);
    if (!hits.length) return null;
    const hit = hits[0];
    if (this.calendar && hit.object === this.calendar.mesh) {
      const i = hit.instanceId ?? -1;
      return i >= 0 ? this.dayExhibit(i) : null;
    }
    return this.registry.resolve(hit.object);
  }

  private dayExhibit(i: number): Exhibit {
    const cached = this.dayCache.get(i);
    if (cached) return cached;
    const day = this.calendar!.days[i];
    const top = -GARDEN_PIT.depth + day.h;
    const ex: Exhibit = {
      id: `day-${i}`,
      kind: 'day',
      title: new Date(`${day.date}T00:00:00Z`).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      subtitle: `${day.count} contribution${day.count === 1 ? '' : 's'}`,
      day: { date: day.date, count: day.count, level: day.level },
      focus: {
        x: clamp(day.x, GARDEN_PIT.x1 + 0.6, GARDEN_PIT.x2 - 0.6),
        z: day.z < 0 ? -3.5 : 3.5,
        lookX: day.x,
        lookY: top,
        lookZ: day.z,
      },
      ringY: top + 0.04,
      ringRadius: 0.3,
    };
    this.dayCache.set(i, ex);
    return ex;
  }
}
