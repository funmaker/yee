import { Cmd, config, loadConfig } from "./src/config";
import Yee from "./src/yee";
import * as client from "./src/client";

try {
  loadConfig(process.argv.slice(2), __dirname);
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
    case Cmd.SET_NAME: {
      const bulb = expectArg(config.args[0], "bulb");
      const name = expectArg(config.args[0], "name", true);
      await client.setName(bulb, name);
      break;
    }
  }
})().catch(console.error);

function expectArg(arg: string | undefined, name: string, canBeEmpty = false) {
  if(arg === undefined || (!canBeEmpty && arg === '')) {
    console.error(`Missing command '${name}'`);
    printHelp(true);
    process.exit(-1);
  }
  
  return arg;
}

function printHelp(error = false) {
  const log = error ? console.error : console.log;
  
  if(error) log();
  log("Usage:");
  log(`\t${process.argv[0]} ${process.argv[1]} <command> [options...]`);
  log();
  log('Commands:');
  log('\tstart\t\tStarts yee server.');
  log('\tstatus\t\tDisplays yee server status.');
  log('\tscan\t\tScans local network for bulbs.');
  log('\tconnect <bulb>\t\tConnect to a light bulb.');
  log('\tdisconnect <bulb>\t\tDisconnect from a light bulb.');
  log('\ton <bulb>\t\tTurn on a light bulb.');
  log('\toff <bulb>\t\tTurn off a light bulb.');
  log('\tsetName <bulb> <name>\t\tSet light bulb name.');
  log();
  log('Options:');
  log('\t--help\t\tDisplays this message.');
  log('\t--host\t-h\tSpecifies host address to use. Can include port. Default \'127.0.0.1\'');
  log('\t--port\t-p\tSpecifies port to use. Default \'3900\'');
  log();
  log('<bulb> can be bulb name, id or location (eg: "yeelight://192.168.12.34:55443")');
}

