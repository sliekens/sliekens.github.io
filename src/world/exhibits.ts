import type * as THREE from 'three';

import type { ActivityItem, CalendarDay, Repo } from '../github/types';

/** Where the camera glides when an exhibit is selected, and what it looks at. */
export interface FocusPoint {
  x: number;
  z: number;
  lookX: number;
  lookY: number;
  lookZ: number;
}

export type ExhibitKind = 'repo' | 'event' | 'day' | 'stat' | 'profile' | 'link' | 'info';

export interface Exhibit {
  id: string;
  kind: ExhibitKind;
  title: string;
  subtitle?: string;
  url?: string;
  body?: string;
  repo?: Repo;
  event?: ActivityItem;
  day?: CalendarDay & { level: number };
  focus: FocusPoint;
  /** Hover ring placement (relative to the exhibit root's position). */
  ringY?: number;
  ringRadius?: number;
  /** The scene object this exhibit is anchored to (set on register). */
  root?: THREE.Object3D;
}

export class ExhibitRegistry {
  readonly pickables: THREE.Object3D[] = [];
  private byId = new Map<string, Exhibit>();
  private seq = 0;

  register(root: THREE.Object3D, exhibit: Omit<Exhibit, 'id' | 'root'>): Exhibit {
    const id = `ex-${this.seq++}`;
    const ex: Exhibit = { ...exhibit, id, root };
    this.byId.set(id, ex);
    root.userData.exhibitId = id;
    root.traverse((o) => {
      o.userData.exhibitId = id;
    });
    this.pickables.push(root);
    return ex;
  }

  get(id: string): Exhibit | undefined {
    return this.byId.get(id);
  }

  /** Walk up the parent chain to find which exhibit an intersected object belongs to. */
  resolve(obj: THREE.Object3D | null): Exhibit | null {
    let cur: THREE.Object3D | null = obj;
    while (cur) {
      const id = cur.userData.exhibitId as string | undefined;
      if (id) return this.byId.get(id) ?? null;
      cur = cur.parent;
    }
    return null;
  }
}
