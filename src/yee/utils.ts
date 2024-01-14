import * as util from "util";
import chalk from "chalk";

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
