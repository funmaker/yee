import readline from "readline";
import { PassThrough } from "stream";
import PromiseRouter from "express-promise-router";
import bodyParser from "body-parser";
import { Request, Response, NextFunction } from "express";
import morgan from "morgan";
import packageJSON from "../../../package.json" assert { type: "json" };
import { CommandRequest, CommandResponse, ConnectResponse, DisconnectResponse, ErrorResponse, JustOk, RefreshResponse, StatusResponse } from "../../apiTypes";
import { config } from "../../config";
import { parseError } from "../utils";
import Yee from "../index";
import HTTPError from "./HTTPError";
import Api from "./index";

export default function makeRootRouter(api: Api, yee: Yee) {
  const router = PromiseRouter();
  
  router.use(bodyParser.urlencoded({ extended: false }));
  router.use(bodyParser.json());
  
  if(config.verbose) {
    const stream = new PassThrough();
    readline.createInterface({ input: stream }).on('line', line => api.log.debug(line));
    
    router.use(morgan('dev', { stream }));
  }
  
  router.get<never, StatusResponse>("/", (req, res) => {
    res.json({
      version: packageJSON.version,
      bulbs: [...yee.bulbs.values()].map(bulb => bulb.serialize()),
    });
  });
  
  router.post<never, JustOk>("/scan", (req, res) => {
    yee.discovery.scan();
    
    res.json({ ok: true });
  });
  
  router.post<{ bulb: string }, ConnectResponse>("/bulb/:bulb/connect", async (req, res) => {
    const bulbs = yee.findBulbs(req.params.bulb);
    if(bulbs.length === 0 && req.params.bulb !== "*") throw new HTTPError(404, "Bulb not found");
    
    const results = await Promise.allSettled(bulbs.filter(bulb => !bulb.connected).map(bulb => bulb.connect()));
    
    res.json({
      success: results.filter(res => res.status === "fulfilled").length,
      failed: results.filter(res => res.status === "rejected").length,
      ignored: bulbs.length - results.length,
      errors: Object.fromEntries(results.flatMap((res, num) => res.status === "rejected" ? [[bulbs[num].id, parseError(res.reason)]] : [])),
    });
  });
  
  router.post<{ bulb: string }, DisconnectResponse>("/bulb/:bulb/disconnect", async (req, res) => {
    const bulbs = yee.findBulbs(req.params.bulb);
    if(bulbs.length === 0 && req.params.bulb !== "*") throw new HTTPError(404, "Bulb not found");
    
    const results = await Promise.allSettled(bulbs.filter(bulb => bulb.connected).map(bulb => bulb.disconnect()));
    
    res.json({
      success: results.filter(res => res.status === "fulfilled").length,
      failed: results.filter(res => res.status === "rejected").length,
      ignored: bulbs.length - results.length,
      errors: Object.fromEntries(results.flatMap((res, num) =>
        res.status === "rejected"
          ? [[bulbs[num].id, parseError(res.reason)]]
          : [],
      )),
    });
  });
  
  router.post<{ bulb: string }, RefreshResponse>("/bulb/:bulb/refresh", async (req, res) => {
    const bulbs = yee.findBulbs(req.params.bulb);
    if(bulbs.length === 0 && req.params.bulb !== "*") throw new HTTPError(404, "Bulb not found");
    
    const results = await Promise.allSettled(bulbs.map(bulb => bulb.refresh()));
    
    res.json({
      success: results.filter(res => res.status === "fulfilled").length,
      failed: results.filter(res => res.status === "rejected").length,
      results: Object.fromEntries(results.map((res, num) =>
        res.status === "rejected"
          ? [bulbs[num].id, parseError(res.reason)]
          : [bulbs[num].id, res.value],
      )),
    });
  });
  
  router.post<{ bulb: string; method: string }, CommandResponse, CommandRequest>("/bulb/:bulb/command/:method", async (req, res) => {
    if(!Array.isArray(req.body.params)) throw new HTTPError(400, "'params' should be an array");
    
    const bulbs = yee.findBulbs(req.params.bulb);
    if(bulbs.length === 0 && req.params.bulb !== "*") throw new HTTPError(404, "Bulb not found");
    
    const results = await Promise.allSettled(bulbs.map(bulb => bulb.command(req.params.method, req.body.params || [])));
    
    res.json({
      success: results.filter(res => res.status === "fulfilled").length,
      failed: results.filter(res => res.status === "rejected").length,
      results: Object.fromEntries(results.map((res, num) =>
        res.status === "rejected"
          ? [bulbs[num].id, parseError(res.reason)]
          : [bulbs[num].id, res.value],
      )),
    });
  });
  
  router.use<never, ErrorResponse>((err: HTTPError, req: Request, res: Response, next: NextFunction) => {
    api.log.error(err);
    
    const result = parseError(err);
    res.status(result.code).json(result);
  });
  
  return router;
}
