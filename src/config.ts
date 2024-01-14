import getopts from "getopts";

export enum Cmd {
  HELP = "help",
  START = "start",
  STATUS = "status",
  SCAN = "scan",
  CONNECT = "connect",
  DISCONNECT = "disconnect",
  ON = "on",
  OFF = "off",
  SET_NAME = "setName",
}

export interface Config {
  port: number;
  host: string;
  command: Cmd;
  args: string[];
  verbose: boolean;
  projectRoot: string;
}

export let config: Config;

export function loadConfig(args: string[], projectRoot: string) {
  const options = getopts(args, {
    alias: {
      port: "p",
      host: "h",
      verbose: "v",
    },
    boolean: ["verbose", "help"],
  });
  
  let host = getStr(options.host, "host", '127.0.0.1');
  let port = 3900;
  const verbose = options.verbose;
  
  if(host.includes(":")) {
    if(host.match(/^.*:\/\//)) throw new Error(`Unexpected protocol in '--host' argument.`);
    
    const split = host.split(":");
    host = split[0];
    port = parseInt(split[1]) || 3900;
  }
  
  port = getNum(options.port, "port", port);
  
  let [strCmd, ...cmdArgs] = options._;
  
  if(options.help) strCmd = Cmd.HELP;
  if(!strCmd) throw new Error(`Missing command.`);
  const command = Object.values(Cmd).find(cmd => cmd.toLowerCase() === strCmd.toLowerCase());
  if(!command) throw new Error(`Unknown command '${strCmd}'.`);
  
  config = {
    port,
    host,
    command,
    args: cmdArgs,
    verbose,
    projectRoot,
  };
}

function getStr(value: string | boolean | string[], name: string, defaultValue?: string) {
  if((value === '' || value === undefined) && defaultValue !== undefined) return defaultValue;
  else if(value === '' || value === undefined) throw new Error(`Option '--${name}' is required.`);
  else if(typeof value === "boolean") throw new Error(`Option '--${name}' is missing an argument.`);
  else if(Array.isArray(value)) throw new Error(`Option '--${name}' was specified multiple times.`);
  else return value;
}

function getNum(value: string | boolean | string[], name: string, defaultValue?: number) {
  value = getStr(value, name, defaultValue?.toString());
  
  const number = parseInt(value);
  if(isNaN(number)) throw new Error(`'--${name} ${value}' is not a number.`);
  else return number;
}
