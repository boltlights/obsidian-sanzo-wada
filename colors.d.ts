/**
 * Type declarations for the Sanzo Wada colors dataset.
 * Using this module declaration avoids heavy JSON type inference in TypeScript.
 */

export interface SanzoColor {
  name: string;
  combinations: number[];
  swatch: number;
  cmyk: [number, number, number, number];
  lab: [number, number, number];
  rgb: [number, number, number];
  hex: string;
}

declare module "*colors.json" {
  const colors: SanzoColor[];
  export default colors;
}

declare module "dictionary-of-colour-combinations" {
  const colors: SanzoColor[];
  export default colors;
}
