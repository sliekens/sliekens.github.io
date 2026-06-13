import { GARDEN_PIT, WALK_SHAPES } from './world/layout';

interface RoomSpot {
  id: string;
  x: number;
  z: number;
  key: string;
}

/** Label/click targets at the visual center of each room. */
const SPOTS: RoomSpot[] = [
  { id: 'rotunda', x: 0, z: 0, key: '1' },
  { id: 'gallery', x: 0, z: -31, key: '2' },
  { id: 'garden', x: -29, z: 0, key: '3' },
  { id: 'timeline', x: 31, z: 0, key: '4' },
  { id: 'about', x: 0, z: 19, key: '5' },
];

/**
 * Tiny fixed minimap drawn from the same walkable shapes that drive
 * collision, with a heading wedge for the player. Clicking a room number
 * teleports there.
 */
export class Minimap {
  private readonly el: HTMLCanvasElement;
  private readonly g: CanvasRenderingContext2D;
  private readonly base: HTMLCanvasElement;
  private readonly dpr = Math.min(window.devicePixelRatio || 1, 2);
  private readonly W = 170;
  private readonly H = 140;
  private readonly s: number;
  private readonly ox: number;
  private readonly oz: number;
  private frame = 0;

  constructor(onTeleport: (roomId: string) => void) {
    const minX = -43;
    const maxX = 47;
    const minZ = -47;
    const maxZ = 25;
    const pad = 9;
    this.s = Math.min(
      (this.W - pad * 2) / (maxX - minX),
      (this.H - pad * 2) / (maxZ - minZ)
    );
    this.ox = (this.W - (maxX - minX) * this.s) / 2 - minX * this.s;
    this.oz = (this.H - (maxZ - minZ) * this.s) / 2 - minZ * this.s;

    const make = (): HTMLCanvasElement => {
      const c = document.createElement('canvas');
      c.width = this.W * this.dpr;
      c.height = this.H * this.dpr;
      return c;
    };

    this.base = make();
    const b = this.base.getContext('2d')!;
    b.scale(this.dpr, this.dpr);
    b.fillStyle = 'rgba(38, 45, 78, 0.92)';
    for (const shape of WALK_SHAPES) {
      b.beginPath();
      if (shape.kind === 'rect') {
        b.rect(
          this.mx(shape.x1),
          this.mz(shape.z1),
          (shape.x2 - shape.x1) * this.s,
          (shape.z2 - shape.z1) * this.s
        );
      } else {
        b.arc(this.mx(shape.x), this.mz(shape.z), shape.r * this.s, 0, Math.PI * 2);
      }
      b.fill();
    }
    const p = GARDEN_PIT;
    b.fillStyle = 'rgba(57, 211, 83, 0.6)';
    b.fillRect(this.mx(p.x1), this.mz(p.z1), (p.x2 - p.x1) * this.s, (p.z2 - p.z1) * this.s);
    b.font = "bold 8px 'JetBrains Mono', monospace";
    b.textAlign = 'center';
    b.textBaseline = 'middle';
    b.fillStyle = 'rgba(212, 175, 55, 0.95)';
    for (const spot of SPOTS) {
      if (spot.id === 'rotunda') continue; // the player marker lives here most of the time
      b.fillText(spot.key, this.mx(spot.x), this.mz(spot.z));
    }

    this.el = make();
    this.el.id = 'minimap';
    this.el.style.width = `${this.W}px`;
    this.el.style.height = `${this.H}px`;
    this.el.title = 'Click a room to jump there';
    this.g = this.el.getContext('2d')!;
    this.g.scale(this.dpr, this.dpr);
    this.el.addEventListener('click', (e) => {
      const r = this.el.getBoundingClientRect();
      const cx = e.clientX - r.left;
      const cy = e.clientY - r.top;
      let best: RoomSpot | null = null;
      let bestDist = 26;
      for (const spot of SPOTS) {
        const d = Math.hypot(cx - this.mx(spot.x), cy - this.mz(spot.z));
        if (d < bestDist) {
          bestDist = d;
          best = spot;
        }
      }
      if (best) onTeleport(best.id);
    });
    document.body.appendChild(this.el);
  }

  setVisible(visible: boolean): void {
    this.el.classList.toggle('show', visible);
  }

  update(x: number, z: number, yaw: number): void {
    if (this.frame++ % 2) return; // 30 fps is plenty for a map
    const g = this.g;
    g.clearRect(0, 0, this.W, this.H);
    g.drawImage(this.base, 0, 0, this.W, this.H);
    g.save();
    g.translate(this.mx(x), this.mz(z));
    g.rotate(Math.atan2(-Math.cos(yaw), -Math.sin(yaw)));
    g.fillStyle = '#ffd966';
    g.beginPath();
    g.moveTo(7, 0);
    g.lineTo(-3.2, 4.4);
    g.lineTo(-1.4, 0);
    g.lineTo(-3.2, -4.4);
    g.closePath();
    g.fill();
    g.restore();
  }

  private mx(x: number): number {
    return this.ox + x * this.s;
  }

  private mz(z: number): number {
    return this.oz + z * this.s;
  }
}
