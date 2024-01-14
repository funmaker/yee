import chalk from "chalk";
import Api from "./api";
import Discovery from "./discovery";
import { makeLogger } from "./utils";
import Bulb, { BulbProperties } from "./bulb";

export default class Yee {
  log = makeLogger(chalk.yellowBright("Yee"));
  api: Api;
  discovery: Discovery;
  bulbs = new Map<string, Bulb>();
  
  constructor() {
    this.log("Yee Server starting...");
    this.api = new Api(this);
    this.discovery = new Discovery(this);
    
    this.upsertBulb("0x0000000018b334b1", {
      name: '',
      location: 'yeelight://192.168.2.3:55443',
      model: 'colorc',
      fwVer: '16',
      support: [
        'get_prop',            'set_default',
        'set_power',           'toggle',
        'set_bright',          'set_scene',
        'cron_add',            'cron_get',
        'cron_del',            'start_cf',
        'stop_cf',             'set_ct_abx',
        'adjust_ct',           'set_name',
        'set_adjust',          'adjust_bright',
        'adjust_color',        'set_rgb',
        'set_hsv',             'set_music',
        'udp_sess_new',        'udp_sess_keep_alive',
        'udp_chroma_sess_new',
      ],
      power: true,
      bright: 50,
      ct: 5000,
      rgb: 16724736,
      hue: 12,
      sat: 100,
    });
  }
  
  findBulb(id: string) {
    if(this.bulbs.has(id)) return this.bulbs.get(id)!;
    
    for(const bulb of this.bulbs.values()) {
      if(bulb.properties.location === id || bulb.properties.location === 'yeelight://' + id) return bulb;
      else if(bulb.properties.name === id) return bulb;
    }
    
    return null;
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
      
      const bulb = new Bulb(id, properties, seen);
      this.bulbs.set(id, bulb);
      return bulb;
    }
  }
}
