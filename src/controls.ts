import * as THREE from 'three';

import type { FocusPoint } from './world/exhibits';
import { EYE_HEIGHT, type WalkableMap } from './world/layout';

export interface ControlsOpts {
  touch: boolean;
  reducedMotion: boolean;
  /** Fired on a quick tap (touch mode) with client coordinates. */
  onTap?: (x: number, y: number) => void;
  onLockChange?: (locked: boolean) => void;
  /** Fired once if the browser refuses pointer lock (e.g. inside an iframe). */
  onLockError?: () => void;
}

interface Tween {
  fx: number;
  fy: number;
  fz: number;
  tx: number;
  ty: number;
  tz: number;
  fyaw: number;
  tyaw: number;
  fpitch: number;
  tpitch: number;
  t: number;
  dur: number;
  done?: () => void;
}

const wrapAngle = (a: number): number => {
  const tau = Math.PI * 2;
  return ((((a + Math.PI) % tau) + tau) % tau) - Math.PI;
};

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/**
 * First-person museum visitor: WASD + pointer-lock mouse look on desktop,
 * dual-zone touch sticks on mobile (left half = move, right half = look),
 * plus scripted camera glides toward selected exhibits.
 */
export class PlayerControls {
  readonly pos = new THREE.Vector3(0, EYE_HEIGHT, 7);
  yaw = 0;
  pitch = 0;
  locked = false;
  /** Movement is ignored until the visitor enters through the intro screen. */
  enabled = false;
  /** Drag-to-look fallback for contexts where pointer lock is denied. */
  dragMode = false;
  isMoving = false;
  isSprinting = false;

  private keys = new Set<string>();
  private dragging = false;
  private dragDist = 0;
  private dragLast = { x: 0, y: 0 };
  private tween: Tween | null = null;
  private bobPhase = 0;
  private bobAmount = 0;
  private moveId = -1;
  private lookId = -1;
  private moveStart = { x: 0, y: 0 };
  private moveVec = { x: 0, y: 0 };
  private lookLast = { x: 0, y: 0 };
  private tapStart: { id: number; x: number; y: number; t: number } | null = null;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly dom: HTMLElement,
    private readonly walkable: WalkableMap,
    private readonly opts: ControlsOpts
  ) {
    camera.rotation.order = 'YXZ';

    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', () => this.keys.clear());

    if (!opts.touch) {
      document.addEventListener('mousemove', this.onMouseMove);
      document.addEventListener('pointerlockchange', () => {
        this.locked = document.pointerLockElement === this.dom;
        if (!this.locked) this.keys.clear();
        this.opts.onLockChange?.(this.locked);
      });
      document.addEventListener('pointerlockerror', () => {
        if (!this.locked && !this.dragMode) {
          this.dragMode = true;
          this.opts.onLockError?.();
        }
      });
      dom.addEventListener('pointerdown', this.onDragDown);
      document.addEventListener('pointermove', this.onDragMove);
      document.addEventListener('pointerup', this.onDragUp);
    } else {
      dom.addEventListener('pointerdown', this.onPointerDown);
      dom.addEventListener('pointermove', this.onPointerMove);
      dom.addEventListener('pointerup', this.onPointerUp);
      dom.addEventListener('pointercancel', this.onPointerUp);
    }
  }

  requestLock(): void {
    if (this.opts.touch || this.dragMode) return;
    try {
      const p = this.dom.requestPointerLock() as unknown as Promise<void> | undefined;
      p?.catch?.(() => {});
    } catch {
      // Pointer lock can be unavailable (e.g. inside some iframes); walking
      // still works with click-drag-free mouse hover selection.
    }
  }

  teleport(x: number, z: number, yaw: number): void {
    this.tween = null;
    this.pos.set(x, EYE_HEIGHT, z);
    this.yaw = yaw;
    this.pitch = -0.04;
  }

  /** Entrance cinematic: descend from inside the dome to the spawn point. */
  flyIn(done?: () => void): void {
    if (this.opts.reducedMotion) {
      this.teleport(0, 7, 0);
      done?.();
      return;
    }
    this.pos.set(0, 11.5, 10.2);
    this.yaw = 0;
    this.pitch = -0.72;
    this.tween = {
      fx: 0,
      fy: 11.5,
      fz: 10.2,
      tx: 0,
      ty: EYE_HEIGHT,
      tz: 7,
      fyaw: 0,
      tyaw: 0,
      fpitch: -0.72,
      tpitch: -0.02,
      t: 0,
      dur: 2.8,
      done,
    };
  }

  /** True when the pointer travelled far enough that a click was a look-drag. */
  wasDragging(): boolean {
    return this.dragDist > 8;
  }

  glideTo(focus: FocusPoint, done?: () => void): void {
    const tyawRaw = Math.atan2(-(focus.lookX - focus.x), -(focus.lookZ - focus.z));
    const tyaw = this.yaw + wrapAngle(tyawRaw - this.yaw);
    const horiz = Math.hypot(focus.lookX - focus.x, focus.lookZ - focus.z);
    const tpitch = clamp(Math.atan2(focus.lookY - EYE_HEIGHT, Math.max(horiz, 0.001)), -1.2, 1.2);
    if (this.opts.reducedMotion) {
      this.tween = null;
      this.pos.x = focus.x;
      this.pos.z = focus.z;
      this.yaw = tyaw;
      this.pitch = tpitch;
      done?.();
      return;
    }
    const travel = Math.hypot(focus.x - this.pos.x, focus.z - this.pos.z);
    this.tween = {
      fx: this.pos.x,
      fy: EYE_HEIGHT,
      fz: this.pos.z,
      tx: focus.x,
      ty: EYE_HEIGHT,
      tz: focus.z,
      fyaw: this.yaw,
      tyaw,
      fpitch: this.pitch,
      tpitch,
      t: 0,
      dur: clamp(0.45 + travel * 0.16, 0.55, 1.3),
      done,
    };
  }

  update(dt: number): void {
    let moving = false;

    if (this.tween) {
      const tw = this.tween;
      tw.t += dt;
      const k = Math.min(1, tw.t / tw.dur);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      this.pos.x = tw.fx + (tw.tx - tw.fx) * e;
      this.pos.y = tw.fy + (tw.ty - tw.fy) * e;
      this.pos.z = tw.fz + (tw.tz - tw.fz) * e;
      this.yaw = tw.fyaw + (tw.tyaw - tw.fyaw) * e;
      this.pitch = tw.fpitch + (tw.tpitch - tw.fpitch) * e;
      if (k >= 1) {
        const cb = tw.done;
        this.tween = null;
        this.pos.y = EYE_HEIGHT;
        cb?.();
      }
    } else if (this.enabled && (this.locked || this.opts.touch || this.dragMode)) {
      const key = (code: string): number => (this.keys.has(code) ? 1 : 0);
      let f = key('KeyW') + key('ArrowUp') - key('KeyS') - key('ArrowDown') + this.moveVec.y;
      let s = key('KeyD') + key('ArrowRight') - key('KeyA') - key('ArrowLeft') + this.moveVec.x;
      const len = Math.hypot(f, s);
      if (len > 1) {
        f /= len;
        s /= len;
      }
      if (len > 0.02) {
        const speed = 4.3 * (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 1.8 : 1);
        const sin = Math.sin(this.yaw);
        const cos = Math.cos(this.yaw);
        const dx = (-sin * f + cos * s) * speed * dt;
        const dz = (-cos * f - sin * s) * speed * dt;
        const next = this.walkable.tryMove(this.pos.x, this.pos.z, this.pos.x + dx, this.pos.z + dz);
        moving = Math.hypot(next.x - this.pos.x, next.z - this.pos.z) > 0.0005;
        this.pos.x = next.x;
        this.pos.z = next.z;
      }
    }

    this.isMoving = moving;
    this.isSprinting =
      moving && (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'));

    // Subtle head bob while walking.
    const bobTarget = moving && !this.opts.reducedMotion ? 1 : 0;
    this.bobAmount += (bobTarget - this.bobAmount) * Math.min(1, dt * 8);
    if (this.bobAmount > 0.01) this.bobPhase += dt * 9;
    const y = this.tween
      ? this.pos.y
      : EYE_HEIGHT + Math.sin(this.bobPhase) * 0.035 * this.bobAmount;

    this.camera.position.set(this.pos.x, y, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    this.keys.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.locked) return;
    this.yaw -= e.movementX * 0.0022;
    this.pitch = clamp(this.pitch - e.movementY * 0.0022, -1.45, 1.45);
  };

  private onDragDown = (e: PointerEvent): void => {
    this.dragDist = 0;
    if (!this.dragMode || this.locked || !this.enabled) return;
    this.dragging = true;
    this.dragLast = { x: e.clientX, y: e.clientY };
  };

  private onDragMove = (e: PointerEvent): void => {
    if (!this.dragging) return;
    const dx = e.clientX - this.dragLast.x;
    const dy = e.clientY - this.dragLast.y;
    this.dragDist += Math.abs(dx) + Math.abs(dy);
    this.yaw -= dx * 0.005;
    this.pitch = clamp(this.pitch - dy * 0.005, -1.45, 1.45);
    this.dragLast = { x: e.clientX, y: e.clientY };
  };

  private onDragUp = (): void => {
    this.dragging = false;
  };

  private onPointerDown = (e: PointerEvent): void => {
    if (!this.enabled) return;
    this.tapStart = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
    if (e.clientX < window.innerWidth * 0.45 && this.moveId === -1) {
      this.moveId = e.pointerId;
      this.moveStart = { x: e.clientX, y: e.clientY };
      this.moveVec = { x: 0, y: 0 };
    } else if (this.lookId === -1) {
      this.lookId = e.pointerId;
      this.lookLast = { x: e.clientX, y: e.clientY };
    }
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (e.pointerId === this.moveId) {
      this.moveVec.x = clamp((e.clientX - this.moveStart.x) / 70, -1, 1);
      this.moveVec.y = clamp(-(e.clientY - this.moveStart.y) / 70, -1, 1);
    } else if (e.pointerId === this.lookId) {
      this.yaw -= (e.clientX - this.lookLast.x) * 0.0045;
      this.pitch = clamp(this.pitch - (e.clientY - this.lookLast.y) * 0.0045, -1.45, 1.45);
      this.lookLast = { x: e.clientX, y: e.clientY };
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (e.pointerId === this.moveId) {
      this.moveId = -1;
      this.moveVec = { x: 0, y: 0 };
    }
    if (e.pointerId === this.lookId) this.lookId = -1;
    if (this.tapStart && this.tapStart.id === e.pointerId) {
      const dist = Math.hypot(e.clientX - this.tapStart.x, e.clientY - this.tapStart.y);
      if (dist < 12 && performance.now() - this.tapStart.t < 350) {
        this.opts.onTap?.(e.clientX, e.clientY);
      }
    }
    this.tapStart = null;
  };
}
