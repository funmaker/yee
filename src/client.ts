import * as util from "util";
import * as fs from "fs";
import * as path from "path";
import colorParse from "color-parse";
import colorRgba from "color-rgba";
import qs from "qs";
import chalk from "chalk";
import axios, { AxiosRequestConfig } from "axios";
import packageJSON from "../package.json" assert { type: "json" };
import { ArgumentError } from "../index";
import { config } from "./config";
import { ColorMode, CommandRequest, CommandResponse, CommandResult, ConnectionStatus, ConnectResponse, DisconnectResponse, ErrorResponse, JustOk, RefreshResponse, StatusResponse } from "./apiTypes";
import { colorTemperature } from "./yee/utils";
import { loadPreset, playPreset } from "./presetPlayer";

interface RequestOptions<Req> extends AxiosRequestConfig<Req> {
  url: string;
  data?: Req;
  search?: string | Req;
}

async function request<Res = void, Req = never>({ search, url, ...options }: RequestOptions<Req>) {
  if(search) {
    if(typeof search === "string") url += search;
    else url += qs.stringify(search, { arrayFormat: "brackets", addQueryPrefix: true });
  }
  
  const baseURL = `http://${config.host}:${config.port}`;
  
  if(config.verbose) {
    console.log(`${options.method || "GET"} request to ${baseURL}${url}`);
    if(options.data) console.log(util.inspect(options.data, { showHidden: false, depth: null, colors: config.color }));
  }
  
  try {
    const response = await axios.request<Res>({
      baseURL,
      url,
      ...options,
    });
    
    if(config.verbose) {
      console.log(`Response:`);
      console.log(util.inspect(response.data, { showHidden: false, depth: null, colors: config.color }));
    }
    
    return response.data;
  } catch(err) {
    if(axios.isAxiosError(err)) {
      if(!err.response) {
        console.error(chalk.redBright.bold("Yee is not reachable: " + err.message));
        console.error("Is the Yee server running? Start the server using 'start' command. See --help for more options.");
        process.exit(-1);
      } else {
        console.error(chalk.redBright.bold(`Request to ${url} failed`));
        console.error(chalk.redBright(`${err.response.status} ${err.response.statusText}`));
        console.error(err.response.data);
        process.exit(-1);
      }
    }
    
    throw err;
  }
}

export async function status() {
  const status = await request<StatusResponse>({ url: "/" });
  
  console.log(chalk.greenBright.bold(`Yee is currently running.`));
  console.log(chalk.blackBright(`Version: ${status.version} (client: ${packageJSON.version})`));
  console.log();
  console.log(`Bulbs (${status.bulbs.length}):`);
  
  status.bulbs.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
  
  let n = 0;
  for(const bulb of status.bulbs) {
    let status;
    if(bulb.connection === ConnectionStatus.CONNECTED) {
      status = chalk.greenBright.bold("CONNECTED");
    } else if(bulb.connection === ConnectionStatus.CONNECTING) {
      status = chalk.yellow.bold("CONNECTING");
    } else if(bulb.connection === ConnectionStatus.RECONNECTING) {
      status = chalk.red.bold("RECONNECTING");
    } else if(bulb.lastSeen) {
      const since = (Date.now() - bulb.lastSeen) / 1000;
      let text;
      if(since < 1) text = "just now";
      else if(since < 60) text = Math.floor(since) + "s ago";
      else if(since < 60 * 60) text = Math.floor(since / 60) + "min ago";
      else if(since < 60 * 60 * 24) text = Math.floor(since / 60 / 60) + "h ago";
      else text = Math.floor(since / 60 / 60 / 24) + " days ago";
      status = chalk.blackBright.bold(`Last seen ${text}`);
    }
    
    n++;
    console.log(`${n}) ${chalk.whiteBright.bold(bulb.name || bulb.id)}${status ? ` (${status})` : ""}`);
    
    printRow("ID", bulb.id);
    printRow("Name", bulb.name);
    
    if(bulb.power === true) printRow("Power", "ON");
    if(bulb.power === false) printRow("Power", chalk.white("OFF"), false);
    
    switch(bulb.colorMode) {
      case ColorMode.RGB:
        if(bulb.rgb === undefined) {
          printRow("RGB", "Unknown Color");
        } else {
          const rgb = bulb.rgb.toString(16).padStart(6, "0").toUpperCase();
          printRow("RGB", `#${chalk.whiteBright(rgb)} ${chalk.hex("#" + rgb)("⬤")}`, false);
        }
        break;
      case ColorMode.CT:
        if(bulb.ct === undefined) {
          printRow("CT", "Unknown Color");
        } else {
          const { r, g, b } = colorTemperature(bulb.ct);
          printRow("CT", `${chalk.whiteBright(bulb.ct)}K ${chalk.rgb(r, g, b)("⬤")}`, false);
        }
        break;
      case ColorMode.HSV:
        if(bulb.hue === undefined || bulb.sat === undefined) {
          printRow("HSV", "Unknown Color");
        } else {
          printRow("HSV", `${chalk.whiteBright(bulb.hue)}° ${chalk.whiteBright(bulb.sat)}% ${chalk.hsv(bulb.hue / 360, bulb.sat / 100, 1)("⬤")}`, false);
        }
        break;
      case undefined:
        break;
      default:
        printRow("Mode", `Invalid(${bulb.colorMode})`);
    }
    
    if(bulb.bright !== undefined) {
      const l = Math.round(bulb.bright / 100 * 255);
      printRow("Brightness", `${chalk.whiteBright(bulb.bright)}% ${chalk.rgb(l, l, l)("⬤")}`);
    }
    
    if(bulb.flowing === true) printRow("Flowing", "ON");
    else if(bulb.flowing === false) printRow("Flowing", "OFF");
    
    if(bulb.musicOn === true) printRow("Music", "ON");
    else if(bulb.musicOn === false) printRow("Music", "OFF");
    
    printRow("Location", bulb.location);
  }
}

export async function scan() {
  await request({
    method: "POST",
    url: "/scan",
  });
  
  console.log("Scan request send.");
}

export async function connect(bulb: string) {
  const response = await request<ConnectResponse>({
    method: "POST",
    url: `/bulb/${bulb}/connect`,
  });
  
  if(response.success + response.failed + response.ignored === 1) {
    if(response.success) console.log("Bulb connected successfully.");
    else if(response.ignored)  console.log("Bulb already connected.");
    else console.log("Unable to connect a bulb due to an error.");
  } else {
    console.log("Successfully connected: " + chalk.greenBright(response.success));
    console.log("Already connected: " + chalk.green(response.ignored));
    console.log("Errors: " + chalk.red(response.failed));
  }
  
  printResults(response.errors, true);
}

export async function disconnect(bulb: string) {
  const response = await request<DisconnectResponse>({
    method: "POST",
    url: `/bulb/${bulb}/disconnect`,
  });
  
  if(response.success + response.failed + response.ignored === 1) {
    if(response.success) console.log("Bulb connected successfully.");
    else if(response.ignored)  console.log("Bulb already connected.");
    else console.log("Unable to connect a bulb due to an error.");
  } else {
    console.log("Successfully disconnected: " + chalk.greenBright(response.success));
    console.log("Already disconnected: " + chalk.green(response.ignored));
    console.log("Errors: " + chalk.red(response.failed));
  }
  
  printResults(response.errors, true);
}

export async function refresh(bulb: string) {
  const response = await request<RefreshResponse>({
    method: "POST",
    url: `/bulb/${bulb}/refresh`,
  });
  
  printSummary(response);
}

export async function on(bulb: string, duration = 0) {
  const response = await request<CommandResponse, CommandRequest>({
    method: "POST",
    url: `/bulb/${bulb}/command/set_power`,
    data: {
      params: [
        "on",
        duration ? "smooth" : "sudden",
        duration,
      ],
    },
  });
  
  printSummary(response);
}

export async function off(bulb: string, duration = 0) {
  const response = await request<CommandResponse, CommandRequest>({
    method: "POST",
    url: `/bulb/${bulb}/command/set_power`,
    data: {
      params: [
        "off",
        duration ? "smooth" : "sudden",
        duration,
      ],
    },
  });
  
  printSummary(response);
}

export async function preset(name: string) {
  if(!config.presets) {
    console.error("Presets are disabled.");
    process.exit(-1);
  }
  
  let files;
  try {
    files = await fs.promises.readdir(config.presets);
  } catch(err) {
    console.error("Failed to list presets:");
    console.error(err);
    process.exit(-1);
  }
  
  for(const file of files) {
    if(file.toLowerCase().startsWith(name.toLowerCase())) {
      console.log("Playing preset " + file);
      const preset = await loadPreset(path.resolve(config.presets, file), file);
      await playPreset(preset);
      break;
    }
  }
}

export async function listPresets() {
  if(!config.presets) {
    console.error("Presets are disabled.");
    process.exit(-1);
  }
  
  let files;
  try {
    files = await fs.promises.readdir(config.presets);
  } catch(err) {
    console.error("Failed to list presets:");
    console.error(err);
    process.exit(-1);
  }
  
  const presets = [];
  for(const file of files) {
    try {
      presets.push(await loadPreset(path.resolve(config.presets, file), file));
    } catch(err) {
      console.error(`Failed to read preset '${file}'`);
      console.error(err);
    }
  }
  
  console.log(`Presets (${presets.length}):`);
  
  let n = 0;
  for(const preset of presets) {
    n++;
    console.log(`${n}) ${chalk.whiteBright.bold(preset.filename)}`);
    printRow("Name", preset.name);
    printRow("Author", preset.author);
    printRow("Description", preset.description);
  }
}

export async function setName(bulb: string, name: string) {
  const response = await request<CommandResponse, CommandRequest>({
    method: "POST",
    url: `/bulb/${bulb}/command/set_power`,
    data: {
      params: [name],
    },
  });
  
  printSummary(response);
}

export async function brightness(bulb: string, brightness: number, duration = 0) {
  const response = await request<CommandResponse, CommandRequest>({
    method: "POST",
    url: `/bulb/${bulb}/command/set_bright`,
    data: {
      params: [
        brightness,
        duration ? "smooth" : "sudden",
        duration,
      ],
    },
  });
  
  printSummary(response);
}

export async function white(bulb: string, kelvin: number, duration = 0) {
  const response = await request<CommandResponse, CommandRequest>({
    method: "POST",
    url: `/bulb/${bulb}/command/set_ct_abx`,
    data: {
      params: [
        kelvin,
        duration ? "smooth" : "sudden",
        duration,
      ],
    },
  });
  
  printSummary(response);
}

export async function color(bulb: string, color: string, duration = 0) {
  const parsed = colorParse(color);
  if(!parsed.space) throw new ArgumentError("Failed to parse 'color' argument.");
  
  function int(val: number, max: number) {
    if(val < 0) return 0;
    if(val > max) return max;
    return Math.round(val);
  }
  
  let response;
  if(parsed.space === "hsv" || parsed.space === "hsl") {
    response = await request<CommandResponse, CommandRequest>({
      method: "POST",
      url: `/bulb/${bulb}/command/set_hsv`,
      data: {
        params: [
          int(parsed.values[0] * 360, 360),
          int(parsed.values[1] * 100, 100),
          duration ? "smooth" : "sudden",
          duration,
        ],
      },
    });
  } else {
    let r, g, b;
    if(parsed.space === "rgb") {
      [r, g, b] = parsed.values;
    } else {
      const rgbaParsed = colorRgba(color);
      if(!rgbaParsed) throw new ArgumentError("Failed to parse 'color' argument.");
      [r, g, b] = rgbaParsed;
    }
    
    r = int(r, 255);
    g = int(g, 255);
    b = int(b, 255);
    
    if(r === 0 && g === 0 && b === 0) throw new ArgumentError("Invalid 'color' argument value. Light can't be black.");
    
    response = await request<CommandResponse, CommandRequest>({
      method: "POST",
      url: `/bulb/${bulb}/command/set_rgb`,
      data: {
        params: [
          (r << 16) + (g << 8) + b,
          duration ? "smooth" : "sudden",
          duration,
        ],
      },
    });
  }
  
  printSummary(response);
}

export async function adjust(bulb: string, action: 'increase' | 'decrease' | 'circle', prop: 'bright' | 'ct' | 'color') {
  const response = await request<CommandResponse, CommandRequest>({
    method: "POST",
    url: `/bulb/${bulb}/command/set_adjust`,
    data: {
      params: [action, prop],
    },
  });
  
  printSummary(response);
}

export async function command(bulb: string, command: string, params: any[]) {
  const response = await request<CommandResponse, CommandRequest>({
    method: "POST",
    url: `/bulb/${bulb}/command/${command}`,
    data: { params },
  });
  
  console.log("Success: " + chalk.greenBright(response.success));
  console.log("Errors: " + chalk.red(response.failed));
  
  printResults(response.results);
}

function printResults(responses: Record<string, CommandResult | ErrorResponse>, onlyError = false) {
  let spacer = true;
  
  for(const [key, response] of Object.entries(responses)) {
    if("error" in response && response.error) {
      if(spacer) {
        spacer = false;
        console.log();
      }
      
      console.log(`${chalk.whiteBright(key)}: ${chalk.redBright(response.code)}${chalk.red(" - " + response.message)}`);
      
      if(response.stack) console.log(chalk.red.dim(response.stack));
    } else if("id" in response && !onlyError) {
      if(spacer) {
        spacer = false;
        console.log();
      }
      
      console.log(`${chalk.whiteBright(key)}: (${response.id}) ${JSON.stringify(response.result)}`);
    }
  }
}

function printSummary(response: CommandResponse) {
  if(response.failed + response.success === 1) {
    if(response.success) console.log(chalk.greenBright("Success"));
    else if(response.failed) console.log(chalk.redBright("Fail"));
  } else {
    console.log("Success: " + chalk.greenBright(response.success));
    console.log("Errors: " + chalk.red(response.failed));
  }
  
  printResults(response.results, true);
}

function printRow(label: string, value: string | undefined, style = true) {
  if(value) console.log(`\t${chalk.white.bold(label)}: ${style ? chalk.whiteBright(value) : value}`);
}
