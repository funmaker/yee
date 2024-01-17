import * as net from "net";
import readline from "readline";
import { BulbProperties, ConnectionStatus, SerializedBulb } from "../apiTypes";
import { config } from "../config";
import HTTPError from "./api/HTTPError";
import { Logger, makeLogger, parseProperties } from "./utils";
import { RequestPromise } from "./requestPromise";
import Yee from "./index";

export default class Bulb {
  lastSeen: number | null = null;
  socket: net.Socket | null = null;
  connecting = false;
  reconnecting = false;
  connectionPromise: Promise<net.Socket> | null = null;
  lastMsgId = -1;
  requests: Record<string, RequestPromise> = {};
  log: Logger;
  
  get connected() {
    return !!this.socket;
  }
  
  constructor(public readonly yee: Yee,
              public readonly id: string,
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
    
    this.yee.saveState().catch(this.log.error);
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
    let success = false;
    
    socket.on("close", hadError => {
      if(hadError) this.log.warn("Connection closed due to an error.");
      else this.log.info("Connection closed.");
      
      this.connectionPromise = null;
      this.socket = null;
      
      if(success && hadError) this.reconnect().catch(this.log.error);
    });
    
    const rl = readline.createInterface({
      input: socket,
    });
    
    rl.on("line", line => {
      try {
        this.onMessage(line);
      } catch(err) {
        this.log.error("Failed to parse incoming message");
        this.log.error(err);
      }
    });
    
    rl.on("error", () => {});
    
    this.connectionPromise = new Promise<net.Socket>((res, rej) => {
      let timeoutId: NodeJS.Timeout | null;
      
      if(config.connectionTimeout) {
        timeoutId = setTimeout(() => {
          timeoutId = null;
          socket.destroy(new Error("Connection Timeout"));
        }, config.connectionTimeout);
      }
      
      socket.once("connect", () => {
        this.log.info("Connection successful");
        if(timeoutId !== null) clearTimeout(timeoutId);
        this.stopReconnecting();
        this.connecting = false;
        success = true;
        res(socket);
      });
      
      socket.once("error", error => {
        this.log.error("Connection error");
        this.log.error(error);
        if(timeoutId !== null) clearTimeout(timeoutId);
        this.connectionPromise = null;
        this.connecting = false;
        rej(error);
      });
    });
    
    return await this.connectionPromise;
  }
  
  async reconnect() {
    if(this.reconnecting || config.reconnect === null) return;
    this.reconnecting = true;
    
    let attempt = 0;
    while(this.reconnecting && (config.reconnect === null || attempt < config.reconnect)) {
      attempt++;
      this.log.info(`Reconnecting... attempt ${attempt}${config.reconnect === null ? '' : `/${config.reconnect}`}`);
      
      try {
        await this.connect();
        this.log.info(`Reconnect successful.`);
        break;
      } catch(err) {
        if(!this.reconnecting) {
          this.log.debug(`Reconnecting interrupted..`);
          break;
        } else if(attempt === config.reconnect) {
          this.log.warn(`Reconnect failed, giving up.`);
          break;
        }
        
        this.log.warn(`Reconnect failed, trying again in ${config.reconnectDelay / 1000}s`);
        await new Promise(res => setTimeout(res, config.reconnectDelay));
      }
    }
    
    this.reconnecting = false;
  }
  
  stopReconnecting() {
    this.reconnecting = false;
  }
  
  onMessage(message: string) {
    this.log.debug("< " + message);
    
    const response: IncomingMessage = JSON.parse(message);
    
    if("method" in response && response.method === "props") {
      this.update(parseProperties(response.params));
    } else if("id" in response) {
      const requestPromise = this.requests[response.id];
      if(!requestPromise) {
        this.log.warn(`Delayed/unknown response. ID: ${response.id}`);
        return;
      }
      
      if("error" in response) {
        requestPromise.reject(new BulbError(response));
      } else {
        requestPromise.resolve(response);
      }
    }
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
    
    this.log.debug("> " + command.trim());
    
    await new Promise<void>((res, rej) => {
      socket.write(command, 'utf-8', (err) => err ? rej(err) : res());
    });
    
    this.requests[id] = new RequestPromise(config.requestTimeout);
    
    try {
      return await this.requests[id];
    } finally {
      delete this.requests[id];
    }
  }
  
  async refresh() {
    const names = ["name", "location", "model", "fw_ver", "support", "power", "bright", "color_mode", "ct", "rgb", "hue", "sat", "flowing", "flow_params", "flowing"];
    const response = await this.command("get_prop", names);
    
    const properties = Object.fromEntries(response.result.map((result, i) => [names[i], result]));
    this.update(parseProperties(properties));
    
    return response;
  }
  
  serialize(): SerializedBulb {
    let connection = ConnectionStatus.DISCONNECTED;
    if(this.connecting) connection = ConnectionStatus.CONNECTING;
    else if(this.connected) connection = ConnectionStatus.CONNECTED;
    else if(this.reconnecting) connection = ConnectionStatus.RECONNECTING;
    
    return {
      ...this.properties,
      id: this.id,
      lastSeen: this.lastSeen,
      connection,
    };
  }
  
  static deserialize(yee: Yee, serialized: SerializedBulb) {
    const { id, lastSeen, connection, ...properties } = serialized;
    
    const bulb = new Bulb(yee, id, properties, false);
    bulb.lastSeen = lastSeen;
    return bulb;
  }
}

class BulbError extends HTTPError {
  constructor(message: ErrorMessage) {
    super(400, `${message.error.message} (${message.error.code})`);
  }
}

export interface ResultMessage {
  id: number;
  result: any[];
}

interface ErrorMessage {
  id: number;
  error: {
    code: number;
    message: string;
  };
}

interface NotificationMessage {
  method: "props";
  params: Record<string, string>;
}

type IncomingMessage = ResultMessage | ErrorMessage | NotificationMessage;
