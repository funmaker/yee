import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import minimist from "minimist";
import chalk from "chalk";
import { ArgumentError } from "../index";

export enum Cmd {
  HELP = "help",
  START = "start",
  STATUS = "status",
  SCAN = "scan",
  CONNECT = "connect",
  DISCONNECT = "disconnect",
  REFRESH = "refresh",
  ON = "on",
  OFF = "off",
  PRESET = "preset",
  LIST_PRESETS = "list-presets",
  SET_NAME = "setName",
  COLOR = "color",
  BRIGHTNESS = "brightness",
  WHITE = "white",
  COMMAND = "command",
}

export interface Config {
  verbose: boolean;
  color: boolean;
  host: string;
  port: number;
  presets: string | null;
  sync: boolean;
  state: string | null;
  reconnect: number | null;
  autoConnect: boolean;
  startConnect: boolean;
  reconnectDelay: number;
  connectionTimeout: number;
  requestTimeout: number;
  projectRoot: string;
  command: Cmd;
  args: string[];
}

export let config: Config = {
  verbose: false,
  color: process.stdout.isTTY,
  host: "127.0.0.1",
  port: 3900,
  presets: null,
  sync: true,
  state: null,
  reconnect: 10,
  autoConnect: true,
  startConnect: true,
  reconnectDelay: 10000,
  connectionTimeout: 10000,
  requestTimeout: 10000,
  projectRoot: process.cwd(),
  command: Cmd.STATUS,
  args: [],
};

export function loadConfig(args: string[], projectRoot: string) {
  const options = minimist(args, {
    alias: {
      host: 'h',
      port: 'p',
      verbose: 'v',
    },
    boolean: ['color', 'verbose', 'sync', 'auto-connect'],
    string: ['config', 'presets', 'state', 'reconnect'],
    default: {
      "help": null,
      "config": null,
      "verbose": null,
      "color": null,
      "host": null,
      "port": null,
      "presets": null,
      "sync": null,
      "state": null,
      "reconnect": null,
      "auto-connect": null, // eslint-disable-line @typescript-eslint/naming-convention
      "start-connect": null, // eslint-disable-line @typescript-eslint/naming-convention
    },
  });
  
  let configPath = null;
  if(options.config !== false) {
    if(typeof options.config === "string" && options.config) {
      configPath = options.config;
    } else if(fs.existsSync(path.join(projectRoot, "configs.json"))) {
      configPath = path.join(projectRoot, "configs.json");
    } else if(fs.existsSync(path.join(os.homedir(), ".yee.json"))) {
      configPath = path.join(projectRoot, "configs.json");
    } else if(fs.existsSync("/etc/yee.json")) {
      configPath = path.join("/etc/yee.json");
    } else {
      console.warn("Unable to find config location");
    }
  }
  
  if(configPath) {
    try {
      const configFile = fs.readFileSync(configPath, "utf-8");
      const configJson = JSON.parse(configFile);
      
      if(typeof configJson.presets === "string" && !path.isAbsolute(configJson.presets)) configJson.presets = path.resolve(path.dirname(configPath), configJson.presets);
      if(typeof configJson.state === "string" && !path.isAbsolute(configJson.state)) configJson.state = path.resolve(path.dirname(configPath), configJson.state);
      
      config = {
        ...config,
        ...configJson,
      };
    } catch(err) {
      console.error(`Failed to read config file at ${configPath}`);
      console.error(err);
    }
  }
  
  if(options.verbose !== null) config.verbose = options.verbose;
  
  if(options.color === true || options.color === "on") {
    chalk.level ||= 1;
    config.color = true;
  } else if(options.color === false || options.color === "off") {
    chalk.level = 0;
    config.color = false;
  }
  
  if(options.port !== null) config.port = getNum(options.port, "port");
  
  if(options.host !== null) config.host = getStr(options.host, "host");
  if(config.host.includes(":")) {
    if(config.host.match(/^.*:\/\//)) throw new Error(`Unexpected protocol in '--host' argument.`);
    
    const split = config.host.split(":");
    config.host = split[0];
    config.port = parseInt(split[1]) || config.port;
  }
  
  if(options.presets === false) config.presets = null;
  else if(options.presets !== null) config.presets = getStr(options.presets, "presets");
  
  if(options.sync !== null) config.sync = options.sync;
  
  if(options.state === false) config.state = null;
  else if(options.state !== null) config.state = getStr(options.state, "state");
  
  if(options.reconnect !== null) config.reconnect = getNum(options.reconnect, "reconnect");
  if(options['auto-connect'] !== null) config.autoConnect = options['auto-connect'];
  if(options['start-connect'] !== null) config.startConnect = options['start-connect'];
  
  let [strCmd, ...cmdArgs] = options._;
  
  if(options.help) strCmd = Cmd.HELP;
  else if(!strCmd) strCmd = Cmd.STATUS;
  
  const command = Object.values(Cmd).find(cmd => cmd.toLowerCase() === strCmd.toLowerCase());
  if(!command) throw new Error(`Unknown command '${strCmd}'.`);
  
  config.command = command;
  config.args = cmdArgs;
}

function getStr(value: string | boolean | string[], name: string) {
  if(typeof value === "boolean") throw new ArgumentError(`Option '--${name}' is missing an argument.`);
  else if(Array.isArray(value)) throw new ArgumentError(`Option '--${name}' was specified multiple times.`);
  else return value;
}

function getNum(value: string | boolean | string[], name: string) {
  value = getStr(value, name);
  
  const number = parseInt(value);
  if(isNaN(number)) throw new ArgumentError(`'--${name} ${value}' is not a number.`);
  else return number;
}
