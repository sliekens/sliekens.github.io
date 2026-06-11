declare module 'troika-three-text' {
  import { Mesh } from 'three';

  export class Text extends Mesh {
    text: string;
    font?: string;
    fontSize: number;
    fontWeight: number | 'normal' | 'bold';
    color: string | number;
    anchorX: 'left' | 'center' | 'right' | number | string;
    anchorY: 'top' | 'top-baseline' | 'middle' | 'bottom-baseline' | 'bottom' | number | string;
    maxWidth: number;
    lineHeight: number | 'normal';
    letterSpacing: number;
    textAlign: 'left' | 'center' | 'right' | 'justify';
    outlineWidth: number | string;
    outlineColor: string | number;
    outlineBlur: number | string;
    outlineOpacity: number;
    fillOpacity: number;
    curveRadius: number;
    depthOffset: number;
    sync(callback?: () => void): void;
    dispose(): void;
  }

  export function preloadFont(
    options: { font?: string; characters?: string | string[]; sdfGlyphSize?: number },
    callback: () => void
  ): void;
}
