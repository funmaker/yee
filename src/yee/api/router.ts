import readline from "readline";
import { PassThrough } from "stream";
import http from "http";
import PromiseRouter from "express-promise-router";
import bodyParser from "body-parser";
import { Request, Response, NextFunction } from "express";
import morgan from "morgan";
import packageJson from "../../../package.json";
import { ErrorResponse, JustOk, SetNameRequest, StatusResponse } from "../../apiTypes";
import { config } from "../../config";
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
      version: packageJson.version,
      bulbs: [...yee.bulbs.values()].map(bulb => bulb.serialize()),
    });
  });
  
  router.post<never, JustOk>("/scan", (req, res) => {
    yee.discovery.scan();
    
    res.json({ ok: true });
  });
  
  router.post<{ bulb: string }, JustOk>("/bulb/:bulb/connect", async (req, res) => {
    const bulb = yee.findBulb(req.params.bulb);
    if(!bulb) throw new HTTPError(404, "Bulb not found");
    
    await bulb.connect();
    
    res.json({ ok: true });
  });
  
  router.post<{ bulb: string }, JustOk>("/bulb/:bulb/disconnect", async (req, res) => {
    const bulb = yee.findBulb(req.params.bulb);
    if(!bulb) throw new HTTPError(404, "Bulb not found");
    
    await bulb.disconnect();
    
    res.json({ ok: true });
  });
  
  router.post<{ bulb: string }, JustOk>("/bulb/:bulb/on", async (req, res) => {
    const bulb = yee.findBulb(req.params.bulb);
    if(!bulb) throw new HTTPError(404, "Bulb not found");
    
    await bulb.on();
    
    res.json({ ok: true });
  });
  
  router.post<{ bulb: string }, JustOk>("/bulb/:bulb/off", async (req, res) => {
    const bulb = yee.findBulb(req.params.bulb);
    if(!bulb) throw new HTTPError(404, "Bulb not found");
    
    await bulb.off();
    
    res.json({ ok: true });
  });
  
  router.post<{ bulb: string }, JustOk, SetNameRequest>("/bulb/:bulb/setName", async (req, res) => {
    const bulb = yee.findBulb(req.params.bulb);
    if(!bulb) throw new HTTPError(404, "Bulb not found");
    
    await bulb.setName(req.body.name);
    
    res.json({ ok: true });
  });
  
  router.use<never, ErrorResponse>((err: HTTPError, req: Request, res: Response, next: NextFunction) => {
    api.log.error(err);
    
    const code = err.HTTPcode || 500;
    const result = {
      code,
      message: err.publicMessage || http.STATUS_CODES[code] || "Something Happened",
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    };
    res.status(code).json(result);
  });
  
  return router;
}
