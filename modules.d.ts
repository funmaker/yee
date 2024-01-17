
declare module 'color-parse' {
  interface Color {
    space: string | undefined;
    values: number[];
    alpha: number;
  }
  
  export default function(color: string): Color;
}
