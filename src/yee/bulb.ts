import * as net from "net";
import readline from "readline";
import { ApiBulb, ColorMode } from "../apiTypes";
import { config } from "../config";
import HTTPError from "./api/HTTPError";
import { Logger, makeLogger } from "./utils";

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
}

export default class Bulb {
  lastSeen: number | null = null;
  socket: net.Socket | null = null;
  connectionPromise: Promise<net.Socket> | null = null;
  lastMsgId = -1;
  log: Logger;
  
  constructor(public readonly id: string,
              public properties: BulbProperties = {},
              seen = true) {
    this.log = makeLogger(properties.name || id);
    
    if(seen) this.lastSeen = Date.now();
  }
  
  update(properties: BulbProperties, seen = true) {
    this.properties = {
      ...this.properties,
      ...properties,
    };
    
    if(properties.name) this.log = makeLogger(properties.name);
    if(seen) this.lastSeen = Date.now();
  }
  
  async connect() {
    if(this.connectionPromise) return await this.connectionPromise;
    else if(this.socket) return this.socket;
    
    this.log.info("Starting connection.");
    
    const location = this.properties.location;
    if(!location) throw new HTTPError(400, "Bulb doesn't have a known location.");
    
    const match = location.match(/yeelight:\/\/(.*):(\d*)/);
    const host = match ? match[1] : "";
    const port = match ? parseInt(match[2]) : 0;
    if(!match || isNaN(port)) throw new HTTPError(400, "Bulb has malformed location.");
    
    const socket = this.socket = net.createConnection(port, host);
    
    socket.on("close", hadError => {
      if(hadError) this.log.warn("Connection closed due to an error.");
      else this.log.info("Connection closed.");
      
      this.socket = null;
    });
    
    const rl = readline.createInterface({
      input: socket,
    });
    
    rl.on("line", (line) => {
      this.log.debug(line);
    });
    
    rl.on("error", () => {});
    
    this.connectionPromise = new Promise<net.Socket>((res, rej) => {
      let timeoutId: NodeJS.Timeout | null = setTimeout(() => {
        timeoutId = null;
        socket.destroy(new Error("Connection Timeout"));
      }, 10000);
      
      socket.on("connect", () => {
        this.log.info("Connection successful");
        if(timeoutId !== null) clearTimeout(timeoutId);
        this.connectionPromise = null;
        res(socket);
      });
      
      socket.on("error", error => {
        this.log.error("Connection error");
        this.log.error(error);
        if(timeoutId !== null) clearTimeout(timeoutId);
        this.connectionPromise = null;
        rej(error);
      });
    });
    
    return await this.connectionPromise;
  }
  
  async disconnect() {
    return new Promise<void>((res, rej) => {
      if(!this.socket) return res();
      
      this.log.info("Closing connection.");
      
      if(this.socket.connecting) {
        this.socket.destroy(new Error("Early disconnect."));
        res();
      } else {
        this.socket.once("close", res);
        this.socket.once("error", rej);
        this.socket.end();
      }
    });
  }
  
  async command(method: string, params: any[]) {
    const socket = await this.connect();
    
    const id = ++this.lastMsgId;
    const command = JSON.stringify({ id, method, params }) + "\r\n";
    
    await new Promise<void>((res, rej) => {
      socket.write(command, 'utf-8', (err) => err ? rej(err) : res());
    });
  }
  
  async on() {
    await this.command("set_power", ["on", "sudden", 0]);
  }
  
  async off() {
    await this.command("set_power", ["off", "sudden", 0]);
  }
  
  async setName(name: string) {
    await this.command("set_name", [name]);
  }
  
  serialize(): ApiBulb {
    return {
      id: this.id,
      lastSeen: this.lastSeen,
      connected: !!this.socket,
      ...this.properties,
    };
  }
}
