import { createSocket, RemoteInfo } from "dgram";
import chalk from "chalk";
import { config } from "../config";
import { makeLogger, parseProperties } from "./utils";
import Yee from "./index";

const searchRequest = encode(
  `M-SEARCH * HTTP/1.1
HOST: 239.255.255.250:1982
MAN: "ssdp:discover"
ST: wifi_bulb`,
);

const port = 1982;
const address = "239.255.255.250";

export default class Discovery {
  log = makeLogger(chalk.blueBright("Discovery"));
  ready = false;
  readyPromise: Promise<void>;
  
  private searchSocket = createSocket({
    type: "udp4",
    reuseAddr: true,
  });
  
  constructor(private readonly yee: Yee) {
    this.searchSocket.on("message", (data, remote) => {
      try {
        this.onMessage(data, remote);
      } catch(err) {
        this.log.error(err);
      }
    });
    
    this.readyPromise = new Promise((res, rej) => {
      this.searchSocket.once("listening", async () => {
        const thisAddr = this.searchSocket.address();
        this.log(`Discovery service started at ${thisAddr.address}:${thisAddr.port}`);
        
        this.searchSocket.setBroadcast(true);
        this.searchSocket.setMulticastTTL(128);
        this.searchSocket.addMembership(address);
        
        this.ready = true;
        res();
        await new Promise(res => setTimeout(res, 10000));
      });
      this.searchSocket.once("error", rej);
      this.searchSocket.bind(port);
    });
  }
  
  scan() {
    this.log.debug(`Broadcasting search request.`);
    this.searchSocket.send(searchRequest, port, address);
  }
  
  onMessage(data: Buffer, remote: RemoteInfo) {
    this.log.debug(`Got response from ${remote.address}:${remote.port} (${remote.size} bytes)`);
    const message = decode(data);
    this.log.debug(message);
    const lines = message.split("\n");
    
    if(lines[0] === "M-SEARCH * HTTP/1.1") {
      return;
    } else if(lines[0] !== "HTTP/1.1 200 OK" && lines[0] !== "NOTIFY * HTTP/1.1") {
      this.log.debug("Invalid response header. Ignoring...");
      return;
    }
    
    const properties: Partial<Record<string, string>> = {};
    
    for(const line of lines.slice(1)) {
      if(line === "") continue;
      
      const separator = line.indexOf(": ");
      if(separator < 0) {
        this.log.debug(`Invalid response line '${line}'. Ignoring...`);
        return;
      }
      
      properties[line.slice(0, separator).toLowerCase()] = line.slice(separator + 2);
    }
    
    if(!properties.id) {
      this.log.warn(`Missing ID in request from ${remote.address}:${remote.port}. Ignoring...`);
      return;
    }
    
    this.yee.upsertBulb(properties.id, parseProperties(properties));
    
    if(config.autoConnect) {
      const bulb = this.yee.bulbs.get(properties.id);
      if(bulb) {
        bulb.connect().catch(err => {
          this.log.error("Bulb auto connect failed:");
          this.log.error(err);
        });
      }
    }
  }
}

function encode(message: string): Buffer {
  return Buffer.from(message.replaceAll("\n", "\r\n"), "utf-8");
}

function decode(data: Buffer): string {
  return data.toString("utf-8").replaceAll("\r\n", "\n");
}
