import createExpress from "express";
import chalk from "chalk";
import Yee from "../index";
import { config } from "../../config";
import { makeLogger } from "../utils";
import makeRootRouter from "./router";

export default class Api {
  log = makeLogger(chalk.cyanBright("Api"));
  server;
  
  constructor(yee: Yee) {
    const express = createExpress();
    
    express.use(makeRootRouter(this, yee));
    
    this.server = express.listen(config.port, config.host, () => {
      this.log(`REST API started on http://${config.host}:${config.port}/`);
    });
  }
}
