/**
 * The museum floor plan. One central rotunda with four wings:
 *
 *                  Repository Gallery (north, -z)
 *                          |
 *   Contribution Garden — Rotunda — Activity Timeline (east, +x)
 *        (west, -x)        |
 *                  About the Curator (south, +z)
 *
 * All walkable areas are described as 2D shapes on the XZ plane; the player
 * is a point with a small radius clamped inside their union.
 */

export const EYE_HEIGHT = 1.7;
export const ROTUNDA_RADIUS = 12;

export interface RectShape {
  kind: 'rect';
  x1: number;
  x2: number;
  z1: number;
  z2: number;
}

export interface CircleShape {
  kind: 'circle';
  x: number;
  z: number;
  r: number;
}

export type Shape = RectShape | CircleShape;

const rect = (x1: number, x2: number, z1: number, z2: number): RectShape => ({
  kind: 'rect',
  x1,
  x2,
  z1,
  z2,
});

export const ROOMS = {
  gallery: rect(-8, 8, -46, -16),
  garden: rect(-42, -16, -13, 13),
  timeline: rect(16, 46, -4, 4),
  about: rect(-6, 6, 14, 24),
} as const;

export const CORRIDORS = {
  north: rect(-3, 3, -17, -9),
  south: rect(-3, 3, 9, 15),
  east: rect(9, 17, -3, 3),
  west: rect(-17, -9, -3, 3),
} as const;

/** Sunken pit in the garden that holds the contribution heatmap tiles. */
export const GARDEN_PIT = { x1: -38.5, x2: -19.5, z1: -2.3, z2: 2.3, depth: 0.8 } as const;

export class WalkableMap {
  constructor(
    private readonly shapes: Shape[],
    private readonly margin = 0.32
  ) {}

  contains(x: number, z: number): boolean {
    const m = this.margin;
    for (const s of this.shapes) {
      if (s.kind === 'rect') {
        if (x >= s.x1 + m && x <= s.x2 - m && z >= s.z1 + m && z <= s.z2 - m) return true;
      } else {
        const dx = x - s.x;
        const dz = z - s.z;
        const r = s.r - m;
        if (dx * dx + dz * dz <= r * r) return true;
      }
    }
    return false;
  }

  /** Move from (fromX, fromZ) toward (toX, toZ), sliding along boundaries. */
  tryMove(fromX: number, fromZ: number, toX: number, toZ: number): { x: number; z: number } {
    if (this.contains(toX, toZ)) return { x: toX, z: toZ };
    if (this.contains(toX, fromZ)) return { x: toX, z: fromZ };
    if (this.contains(fromX, toZ)) return { x: fromX, z: toZ };
    return { x: fromX, z: fromZ };
  }
}

/** Every walkable region; also drives the minimap drawing. */
export const WALK_SHAPES: Shape[] = (() => {
  const g = ROOMS.garden;
  const pit = GARDEN_PIT;
  return [
    { kind: 'circle', x: 0, z: 0, r: ROTUNDA_RADIUS },
    CORRIDORS.north,
    CORRIDORS.south,
    CORRIDORS.east,
    CORRIDORS.west,
    ROOMS.gallery,
    ROOMS.timeline,
    ROOMS.about,
    // Garden walkway: the room minus the pit, expressed as a frame of four rects.
    rect(g.x1, g.x2, g.z1, pit.z1),
    rect(g.x1, g.x2, pit.z2, g.z2),
    rect(g.x1, pit.x1, g.z1, g.z2),
    rect(pit.x2, g.x2, g.z1, g.z2),
  ];
})();

export function createWalkableMap(): WalkableMap {
  return new WalkableMap(WALK_SHAPES);
}

export interface RoomAnchor {
  id: string;
  label: string;
  key: string;
  x: number;
  z: number;
  yaw: number;
}

/**
 * Teleport anchors for HUD navigation and number keys.
 * Yaw convention: forward = (-sin(yaw), 0, -cos(yaw)); yaw 0 looks toward -z.
 */
export const ROOM_ANCHORS: RoomAnchor[] = [
  { id: 'rotunda', label: 'Rotunda', key: '1', x: 0, z: 7, yaw: 0 },
  { id: 'gallery', label: 'Repositories', key: '2', x: 0, z: -17.5, yaw: 0 },
  { id: 'garden', label: 'Contributions', key: '3', x: -18, z: 0, yaw: Math.PI / 2 },
  { id: 'timeline', label: 'Timeline', key: '4', x: 18, z: 0, yaw: -Math.PI / 2 },
  { id: 'about', label: 'About', key: '5', x: 0, z: 15.5, yaw: Math.PI },
];
