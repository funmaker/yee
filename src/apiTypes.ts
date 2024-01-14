export interface ErrorResponse {
  code: number;
  message: string;
  stack?: string;
}

export interface JustOk {
  ok: true;
}

export interface StatusResponse {
  version: string;
  bulbs: ApiBulb[];
}

export interface SetNameRequest {
  name: string;
}

export interface ApiBulb {
  id: string;
  lastSeen: number | null;
  connected?: boolean;
  name?: string;
  location?: string;
  model?: string;
  fwVer?: string;
  support?: string[];
  power?: boolean;
  bright?: number;
  colorMode?: ColorMode;
  ct?: number;
  rgb?: number;
  hue?: number;
  sat?: number;
}

export enum ColorMode {
  NONE = 0,
  RGB = 1,
  CT = 2,
  HSV = 3,
}

