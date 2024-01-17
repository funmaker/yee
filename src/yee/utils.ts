import http from "http";
import * as util from "util";
import chalk from "chalk";
import { BulbProperties, ErrorResponse } from "../apiTypes";

export interface Logger {
  (...message: any[]): void;
  debug: (...message: any[]) => void;
  info: (...message: any[]) => void;
  warn: (...message: any[]) => void;
  error: (...message: any[]) => void;
}

export function makeLogger(label: string): Logger {
  function base(level: "DEBUG" | "INFO" | "WARN" | "ERROR", ...message: any[]) {
    let coloredLevel = label;
    switch(level) {
      case "DEBUG": coloredLevel = chalk.white(level); break;
      case "INFO": coloredLevel = chalk.whiteBright(level); break;
      case "WARN": coloredLevel = chalk.yellowBright.bold(level); break;
      case "ERROR": coloredLevel = chalk.redBright.bold(level); break;
    }
    
    const prefix =
      chalk.white.bold(":: ") +
      chalk.white.dim(new Date().toLocaleString()) +
      chalk.white.bold(" :: ") +
      label +
      chalk.white.bold(" :: ") +
      coloredLevel +
      chalk.white.bold(" :: ");
    
    const text = message.map(value => typeof value === "string"
                                               ? value
                                               : util.inspect(value, { colors: process.stdout.hasColors() }))
                        .join(" ")
                        .split("\n")
                        .map(line => prefix + line)
                        .join("\n");
    
    if(level === "ERROR") console.error(text);
    else if(level === "WARN") console.warn(text);
    else console.log(text);
  }
  
  const log = (...message: any[]) => base("INFO", ...message);
  log.debug = (...message: any[]) => base("DEBUG", ...message);
  log.info = (...message: any[]) => base("INFO", ...message);
  log.warn = (...message: any[]) => base("WARN", ...message);
  log.error = (...message: any[]) => base("ERROR", ...message);
  
  return log;
}

export function parseProperties(rawData: Partial<Record<string, string | number>>) {
  const data = Object.fromEntries(Object.entries(rawData).map(([key, value]) => [key.toLowerCase(), typeof value === "number" ? value.toString() : value]));
  
  const properties: BulbProperties = {
    name: data.name,
    location: data.location,
    model: data.model,
    fwVer: data.fw_ver,
    support: data.support?.split(" "),
    power: data.power ? data.power === "on" : undefined,
    bright: data.bright ? parseInt(data.bright) : undefined,
    colorMode: data.color_mode ? parseInt(data.color_mode) : undefined,
    ct: data.ct ? parseInt(data.ct) : undefined,
    rgb: data.rgb ? parseInt(data.rgb) : undefined,
    hue: data.hue ? parseInt(data.hue) : undefined,
    sat: data.sat ? parseInt(data.sat) : undefined,
    flowing: data.flowing ? data.flowing === "1" : undefined,
    flowParams: data.flow_params,
    musicOn: data.flowing ? data.music_on === "1" : undefined,
  };
  
  const keys = Object.keys(properties) as Array<keyof typeof properties>;
  for(const key of keys) {
    if(properties[key] === undefined) delete properties[key];
  }
  
  return properties;
}

export function parseError(err: any): ErrorResponse {
  const code = err.HTTPcode || 500;
  
  return {
    error: true,
    code,
    message: err.publicMessage || http.STATUS_CODES[code] || "Something Happened",
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  };
}

// from: https://github.com/neilbartlett/color-temperature/blob/master/index.js
export function colorTemperature(kelvin: number) {
  const temperature = kelvin / 100.0;
  let red, green, blue;
  
  if(temperature < 66.0) {
    red = 255;
  } else {
    red = temperature - 55.0;
    red = 351.97690566805693 + 0.114206453784165 * red - 40.25366309332127 * Math.log(red);
    if(red < 0) red = 0;
    if(red > 255) red = 255;
  }
  
  if(temperature < 66.0) {
    green = temperature - 2;
    green = -155.25485562709179 - 0.44596950469579133 * green + 104.49216199393888 * Math.log(green);
    if(green < 0) green = 0;
    if(green > 255) green = 255;
  } else {
    green = temperature - 50.0;
    green = 325.4494125711974 + 0.07943456536662342 * green - 28.0852963507957 * Math.log(green);
    if(green < 0) green = 0;
    if(green > 255) green = 255;
  }
  
  if(temperature >= 66.0) {
    blue = 255;
  } else if(temperature <= 20.0) {
    blue = 0;
  } else {
    blue = temperature - 10;
    blue = -254.76935184120902 + 0.8274096064007395 * blue + 115.67994401066147 * Math.log(blue);
    if(blue < 0) blue = 0;
    if(blue > 255) blue = 255;
  }
  
  return { r: Math.round(red), g: Math.round(green), b: Math.round(blue) };
}

// eslint-disable-next-line space-before-function-paren
export function debounce<R, Args extends any[]>(fn: (...args: Args) => Promise<R>, delay: number): (...args: Args) => Promise<R> {
  let current: Promise<R> | null = null;
  let future: Promise<R> | null = null;
  let futureArgs: Args | null = null;
  let lastCall: number | null = null;
  
  return async (...args) => {
    futureArgs = args;
    
    if(!future) {
      future = (async () => {
        try {
          await current;
        } catch(e) {
          // ignore
        }
        
        if(lastCall !== null) {
          const sinceCall = Date.now() - lastCall;
          if(sinceCall < delay) await new Promise(res => setTimeout(res, delay - sinceCall));
        }
        
        lastCall = Date.now();
        future = null;
        current = fn(...futureArgs!);
        
        return await current;
      })();
    }
    
    return await future;
  };
}
