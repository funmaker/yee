import HTTPError from "./api/HTTPError";
import { ResultMessage } from "./bulb";

type Executor<T> = (resolve: (message: T) => void, reject: (error: Error) => void) => void;

export class RequestPromise extends Promise<ResultMessage> {
  fullfilled = false;
  private res!: (message: ResultMessage) => void;
  private rej!: (error: Error) => void;
  private timeoutId: NodeJS.Timeout | null = null;
  
  constructor(timeout: number | Executor<ResultMessage> = 0) {
    let res, rej;
    
    super((resolve, reject) => {
      res = resolve;
      rej = reject;
    });
    
    this.res = res!;
    this.rej = rej!;
    
    if(typeof timeout === "number") {
      if(timeout !== 0) {
        this.timeoutId = setTimeout(() => {
          this.timeoutId = null;
          this.reject(new HTTPError(408, "Bulb response timeout"));
        }, timeout);
      }
    } else {
      timeout(this.res, this.rej);
    }
  }
  
  resolve(message: ResultMessage) {
    if(this.fullfilled) return;
    this.fullfilled = true;
    
    if(this.timeoutId) clearTimeout(this.timeoutId);
    this.timeoutId = null;
    
    this.res(message);
  }
  
  reject(error: Error) {
    if(this.fullfilled) return;
    this.fullfilled = true;
    
    if(this.timeoutId) clearTimeout(this.timeoutId);
    this.timeoutId = null;
    
    this.rej(error);
  }
}
