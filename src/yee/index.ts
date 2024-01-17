import * as fs from "fs";
import chalk from "chalk";
import { SerializedBulb, BulbProperties } from "../apiTypes";
import { config } from "../config";
import Api from "./api";
import Discovery from "./discovery";
import { debounce, makeLogger } from "./utils";
import Bulb from "./bulb";

export default class Yee {
  log = makeLogger(chalk.yellowBright("Yee"));
  api: Api;
  discovery: Discovery;
  bulbs = new Map<string, Bulb>();
  
  constructor() {
    this.log("Yee Server starting...");
    this.api = new Api(this);
    this.discovery = new Discovery(this);
    
    this.loadState().catch(this.log.error);
  }
  
  findBulbs(id: string): Bulb[] {
    if(id === "*") return [...this.bulbs.values()];
    else if(this.bulbs.has(id)) return [this.bulbs.get(id)!];
    else {
      id = id.toLowerCase();
      return [...this.bulbs.values()].filter(bulb => (
        bulb.properties.location?.toLowerCase() === id
        || bulb.properties.location?.toLowerCase() === 'yeelight://' + id
        || bulb.properties.name?.toLowerCase() === id
      ));
    }
  }
  
  upsertBulb(id: string, properties: BulbProperties, seen = true) {
    const existing = this.bulbs.get(id);
    const name = properties.name || existing?.properties?.name || properties.location || existing?.properties?.location || "UNKNOWN";
    
    if(existing) {
      this.log.debug(`Updating ${name} bulb (${id}).`);
      
      existing.update(properties, seen);
      
      return existing;
    } else {
      this.log.debug(`Adding new ${name} bulb (${id}).`);
      
      const bulb = new Bulb(this, id, properties, seen);
      this.bulbs.set(id, bulb);
      this.saveState().catch(this.log.error);
      
      return bulb;
    }
  }
  
  async loadState() {
    if(!config.state) return;
    
    try {
      const state: YeeState = JSON.parse(await fs.promises.readFile(config.state, "utf-8"));
      const bulbs = state.bulbs.map(bulb => Bulb.deserialize(this, bulb));
      
      for(const bulb of bulbs) {
        this.bulbs.set(bulb.id, bulb);
      }
    } catch(err) {
      if((err as any).code === "ENOENT") {
        this.log.warn(`State file not found at ${config.state}.`);
        return;
      }
      
      this.log.error("Failed to load state:");
      this.log.error(err);
      return;
    }
    
    if(config.startConnect) {
      for(const bulb of this.bulbs.values()) {
        bulb.connect().catch(err => {
          this.log.error("Start up connect failed:");
          this.log.error(err);
        });
      }
    }
  }
  
  saveState = debounce(async () => {
    if(!config.state) return;
    
    try {
      const state: YeeState = {
        bulbs: [...this.bulbs.values()].map(bulb => bulb.serialize()),
      };
      
      await fs.promises.writeFile(config.state, JSON.stringify(state, null, 4));
    } catch(err) {
      this.log.error("Failed to save state:");
      this.log.error(err);
      config.state = null;
      return;
    }
  }, 5000);
}

interface YeeState {
  bulbs: SerializedBulb[];
}
