import fs from "fs";
import stream from "stream";
import cp from "child_process";
import colorRgba from "color-rgba";
import * as client from "./client";

interface Preset {
  filename: string;
  name?: string;
  author?: string;
  description?: string;
  steps?: Step[];
}

interface Step {
  bulb?: string;
  power?: "on" | "off";
  scene?: boolean;
  color?: string;
  white?: number;
  flow?: FlowStep[] | false;
  flowCount?: number;
  flowAction?: 'recover' | 'stay' | 'off';
  brightness?: number;
  duration?: number;
  sleep?: number;
  mpv?: string;
  preset?: string;
}

type FlowStep = [number] | [number, string | number] | [number, string | number, number];

let mpv: cp.ChildProcessByStdio<null, stream.Readable, null> | null = null;

export async function loadPreset(path: string, filename: string): Promise<Preset> {
  const preset = JSON.parse(await fs.promises.readFile(path, "utf-8"));
  preset.filename = filename;
  return preset;
}

export async function playPreset(preset: Preset) {
  if(!preset.steps) {
    console.log("Nothing to play.");
    return;
  }
  
  if(!Array.isArray(preset.steps)) throw new Error("preset.steps is not an Array");
  for(const step of preset.steps) {
    const bulb = step.bulb ?? "*";
    const duration = step.duration ?? 0;
    
    const flow = {
      count: step.flowCount ?? 0,
      action: FlowAction.STAY,
      expression: [] as number[],
    };
    
    if(step.flowAction === "recover") flow.action = FlowAction.RECOVER;
    else if(step.flowAction === "stay") flow.action = FlowAction.STAY;
    else if(step.flowAction === "off") flow.action = FlowAction.OFF;
    else if(step.flowAction) throw new Error(`Unexpected flow action ${step.flowAction}`);
    
    if(step.flow) {
      for(const flowStep of step.flow) {
        const [duration, color, brightness = -1] = flowStep;
        
        if(color === undefined) {
          flow.expression.push(Math.max(duration, 50), FlowMode.SLEEP, 0, 0);
        } else if(typeof color === "number") {
          flow.expression.push(Math.max(duration, 50), FlowMode.WHITE, color, brightness);
        } else {
          const [r, g, b] = parseColor(color);
          flow.expression.push(Math.max(duration, 50), FlowMode.COLOR, (r << 16) + (g << 8) + b, brightness);
        }
      }
    }
    
    if(step.sleep) {
      await new Promise(res => setTimeout(res, step.sleep));
    } else if(step.scene) {
      if(step.color !== undefined) {
        const [r, g, b] = parseColor(step.color);
        await client.command(bulb, "set_scene", ["color", (r << 16) + (g << 8) + b, step.brightness || 100]);
      } else if(step.white !== undefined) {
        await client.command(bulb, "set_scene", ["ct", step.white, step.brightness || 100]);
      } else if(step.flow !== undefined) {
        await client.command(bulb, "set_scene", ["cf", flow.count, flow.action, flow.expression.join(",")]);
      }
    } else if(step.power === "on") {
      await client.on(bulb, duration);
    } else if(step.power === "off") {
      await client.off(bulb, duration);
    } else if(step.color !== undefined) {
      await client.color(bulb, step.color, duration);
    } else if(step.white !== undefined) {
      await client.white(bulb, step.white, duration);
    } else if(step.brightness !== undefined) {
      await client.brightness(bulb, step.brightness, duration);
    } else if(step.flow === false) {
      await client.command(bulb, "stop_cf", []);
    } else if(step.flow) {
      await client.command(bulb, "start_cf", [flow.count, flow.action, flow.expression.join(",")]);
    } else if(step.preset) {
      await client.preset(step.preset);
    } else if(step.mpv === "wait") {
      if(mpv) {
        await new Promise<void>(res => {
          mpv!.once("exit", () => res());
        });
      }
    } else if(step.mpv) {
      if(mpv) throw new Error("MPV is already running");
      const spawned = mpv = cp.spawn("mpv", [step.mpv], {
        stdio: ["ignore", "pipe", process.stderr],
      });
      
      spawned.on("exit", () => mpv = null);
      
      await new Promise<void>((res, rej) => {
        spawned.stdout.once("data", () => res());
        spawned.once("exit", () => rej());
      });
    } else {
      throw new Error("Failed to parse step: " + JSON.stringify(step));
    }
  }
}

function parseColor(color: string) {
  const parsed = colorRgba(color);
  if(!parsed) throw new Error(`Failed to parse color ${color}`);
  
  const [r, g, b] = parsed;
  if(r === 0 && g === 0 && b === 0) throw new Error("Invalid color. Light can't be black.");
  
  return [r, g, b];
}

enum FlowMode {
  COLOR = 1,
  WHITE = 2,
  SLEEP = 7,
}

enum FlowAction {
  RECOVER = 0,
  STAY = 1,
  OFF = 2,
}
