declare module 'colorthief' {
  export function getColor(source: any, options?: any): Promise<number[]>;
  export function getPalette(source: any, colorCount?: number, options?: any): Promise<number[][]>;
  export function getColorSync(source: any, options?: any): number[];
  export function getPaletteSync(source: any, colorCount?: number, options?: any): number[][];
}
