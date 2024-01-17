import chalk from "chalk";
import { Cmd, config, loadConfig } from "./src/config";
import Yee from "./src/yee";
import * as client from "./src/client";

export class ArgumentError extends Error {}

try {
  const dirname = new URL('.', import.meta.url).pathname;
  loadConfig(process.argv.slice(2), dirname);
} catch(err) {
  console.error((err as Error).message);
  printHelp(true);
  process.exit(-1);
}

(async () => {
  switch(config.command) {
    case Cmd.HELP:
      printHelp(false);
      break;
    case Cmd.START:
      new Yee();
      break;
    case Cmd.STATUS:
      await client.status();
      break;
    case Cmd.SCAN:
      await client.scan();
      break;
    case Cmd.CONNECT: {
      const bulb = expectArg(config.args[0], "bulb");
      await client.connect(bulb);
      break;
    }
    case Cmd.DISCONNECT: {
      const bulb = expectArg(config.args[0], "bulb");
      await client.disconnect(bulb);
      break;
    }
    case Cmd.REFRESH: {
      const bulb = expectArg(config.args[0], "bulb");
      await client.refresh(bulb);
      break;
    }
    case Cmd.ON: {
      const bulb = expectArg(config.args[0], "bulb");
      await client.on(bulb);
      break;
    }
    case Cmd.OFF: {
      const bulb = expectArg(config.args[0], "bulb");
      await client.off(bulb);
      break;
    }
    case Cmd.PRESET: {
      const preset = expectArg(config.args[0], "preset");
      await client.preset(preset);
      break;
    }
    case Cmd.LIST_PRESETS: {
      await client.listPresets();
      break;
    }
    case Cmd.SET_NAME: {
      const bulb = expectArg(config.args[0], "bulb");
      const name = expectArg(config.args[1], "name", true);
      await client.setName(bulb, name);
      break;
    }
    case Cmd.BRIGHTNESS: {
      const bulb = expectArg(config.args[0], "bulb");
      if(config.args[1] === "increase" || config.args[1] === "decrease" || config.args[1] === "circle") {
        await client.adjust(bulb, config.args[1], "bright");
        break;
      }
      
      const brightness = parseInt(expectArg(config.args[1], "level"));
      if(isNaN(brightness)) throw new ArgumentError("Failed to parse 'level' argument.");
      if(brightness < 1 || brightness > 100) throw new ArgumentError("Invalid 'level' argument value. Must be within 1 to 100 range.");
      
      await client.brightness(bulb, brightness);
      
      break;
    }
    case Cmd.WHITE: {
      const bulb = expectArg(config.args[0], "bulb");
      if(config.args[1] === "increase" || config.args[1] === "decrease" || config.args[1] === "circle") {
        await client.adjust(bulb, config.args[1], "ct");
        break;
      }
      
      const temperature = parseInt(expectArg(config.args[1], "temperature"));
      if(isNaN(temperature)) throw new ArgumentError("Failed to parse 'temperature' argument.");
      if(temperature < 3000 || temperature > 6500) throw new ArgumentError("Invalid 'temperature' argument value. Must be within 3000K to 6500K range.");
      
      await client.white(bulb, temperature);
      
      break;
    }
    case Cmd.COLOR: {
      const bulb = expectArg(config.args[0], "bulb");
      const color = expectArg(config.args[1], "color");
      
      if(color === "circle") {
        await client.adjust(bulb, color, "ct");
      } else {
        await client.color(bulb, color);
      }
      
      break;
    }
    case Cmd.COMMAND: {
      const bulb = expectArg(config.args[0], "bulb");
      const method = expectArg(config.args[1], "method");
      const paramsStr = expectArg(config.args[2], "params");
      let params;
      try {
        params = JSON.parse(paramsStr);
        if(!Array.isArray(params)) throw new Error("Argument 'params' must be a JSON-encoded array");
      } catch(err) {
        throw new ArgumentError("Failed to parse 'params' argument: " + (err as Error).message);
      }
      await client.command(bulb, method, params);
      break;
    }
  }
})().catch((err) => {
  if(err instanceof ArgumentError) {
    console.error(err.message);
    printHelp(true);
    process.exit(-1);
  } else throw err;
});

function expectArg(arg: string | undefined, name: string, canBeEmpty = false) {
  if(arg === undefined || (!canBeEmpty && arg === '')) throw new ArgumentError(`Missing argument '${name}'`);
  
  return arg;
}

function printHelp(error = false) {
  const log = error ? console.error : console.log;
  const table = (rows: string[][]) => {
    const cols: number[] = [];
    
    rows.forEach(row =>
      row.forEach((cell, column) =>
        cols[column] = Math.max(cols[column] || 0, cell.length),
      ),
    );
    
    cols.pop();
    
    const lines = rows.map(row => row.map((cell, column) => cell.padEnd(cols[column] || 0, " ")).join("\t"));
    
    lines.forEach(line => log("\t" + line));
  };
  
  if(error) log();
  log(chalk.whiteBright.bold("Usage:"));
  log(`\tyee <command> [options...]`);
  log();
  log(chalk.whiteBright.bold('Commands:'));
  table([
    ['\tstart', 'Starts yee server.'],
    ['\tstatus', 'Displays yee server status.'],
    ['\tscan', 'Scans local network for bulbs.'],
    ['\tconnect <bulb>', 'Connect to a light bulb.'],
    ['\tdisconnect <bulb>', 'Disconnect from a light bulb.'],
    ['\trefresh <bulb>', 'Refreshes light bulb state.'],
    ['\ton <bulb>', 'Turn on a light bulb.'],
    ['\toff <bulb>', 'Turn off a light bulb.'],
    ['\tpreset <bulb> <preset>', 'Launch specific preset.'],
    ['\tlist-presets', 'List all avaliable presets.'],
    ['\tsetName <bulb> <name>', 'Set light bulb name.'],
    ['\tbrightness <bulb> <level>', 'Set light bulb brightness. <level> must be within 1 to 100 range'],
    ['\twhite <bulb> <temperature>', 'Set light bulb color temperature. <temperature> must be within 1700K to 6500K range'],
    ['\tcolor <bulb> <color>', 'Set light bulb color.'],
    ['\tcommand <bulb> <method> <params>', 'Sends an arbitrary command. <params> must be an JSON-encoded string'],
  ]);
  log();
  log('<bulb> can be bulb name, id or location (eg: "yeelight://192.168.12.34:55443") or "*". "*" targets all known light bulbs.');
  log('<color> can be any CSS color string (eg: "blue", "#FF00FF", "hsv(0.5, 0.5, 1)", etc.). Lightness/value part of HSV/HSL is ignored.');
  log('<level> and <temperature> can be "increase", "decrease" and "circle" for relative adjustment. <color> can be "circle".');
  log();
  log(chalk.whiteBright.bold('General options:'));
  table([
    ['--help', '', 'Displays this message.'],
    ['--config <path>', '--no-config', 'Config location. Defaults to \'{projectRoot}/config.json\', \'~/.yee.json\' or \'/etc/yee.json\''],
    ['--verbose', '', 'Enables debug output.'],
    ['--color', '--no-color', 'Controls color output.'],
    ['--host', '-h', 'Host address to use. Can include port. Default \'127.0.0.1\'.'],
    ['--port', '-p', 'Port to use. Default \'3900\'.'],
  ]);
  log();
  log(chalk.whiteBright.bold('Client options:'));
  table([
    ['--presets <path>', '--no-presets', 'Presets directory location. Default \'{projectRoot}/presets\''],
    ['', '--no-sync', 'Do not wait for bulb response.'],
  ]);
  log();
  log(chalk.whiteBright.bold('Server options:'));
  table([
    ['--state <path>', '--no-state', 'Specifies persistent state file location. Default \'{projectRoot}/state.json\''],
    ['--reconnect <maxTries>', '--no-reconnect', 'Maximum number of reconnect attempts before giving up. \'0\' means no limit. Default \'10\''],
    ['--auto-connect', '--no-auto-connect', 'Connect to bulbs automatically when detected. Default \'true\''],
    ['--start-connect', '--no-start-connect', 'Connect to all known bulbs automatically on start. Default \'true\''],
  ]);
}
