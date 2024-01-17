
export interface ErrorResponse {
  error: true;
  code: number;
  message: string;
  stack?: string;
}

export interface StatusResponse {
  version: string;
  bulbs: SerializedBulb[];
}

export interface ConnectResponse {
  success: number;
  failed: number;
  ignored: number;
  errors: Record<string, ErrorResponse>;
}

export type DisconnectResponse = ConnectResponse;

export interface CommandRequest {
  params?: any[];
}

export interface CommandResponse {
  success: number;
  failed: number;
  results: Record<string, CommandResult | ErrorResponse>;
}

export type RefreshResponse = CommandResponse;

export interface CommandResult {
  id: number;
  result: any[];
}

export interface SerializedBulb extends BulbProperties {
  id: string;
  lastSeen: number | null;
  connection: ConnectionStatus;
}

export interface BulbProperties {
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
  flowing?: boolean;
  flowParams?: string;
  musicOn?: boolean;
}

export enum ColorMode {
  NONE = 0,
  RGB = 1,
  CT = 2,
  HSV = 3,
}

export enum ConnectionStatus {
  DISCONNECTED = "disconnected",
  RECONNECTING = "reconnecting",
  CONNECTING = "connecting",
  CONNECTED = "connected",
}

export interface JustOk {
  ok: true;
}

