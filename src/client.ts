import qs from "qs";
import axios, { AxiosRequestConfig } from "axios";
import { config } from "./config";
import { JustOk, SetNameRequest, StatusResponse } from "./apiTypes";

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
  
  const response = await axios.request<Res>({
    baseURL: `http://${config.host}:${config.port}`,
    url,
    ...options,
  });
  
  return response.data;
}

export async function status() {
  const status = await request<StatusResponse>({ url: "/" });
  
  console.log(`Yee is running on version ${status.version}`);
  console.log();
  console.log(`Bulbs (${status.bulbs.length}):`);
  for(const bulb of status.bulbs) {
    console.log(bulb);
  }
}

export async function scan() {
  await request({
    method: "POST",
    url: "/scan",
  });
}

export async function connect(bulb: string) {
  await request<JustOk>({
    method: "POST",
    url: `/bulb/${bulb}/connect`,
  });
}

export async function disconnect(bulb: string) {
  await request<JustOk>({
    method: "POST",
    url: `/bulb/${bulb}/disconnect`,
  });
}

export async function on(bulb: string) {
  await request<JustOk>({
    method: "POST",
    url: `/bulb/${bulb}/on`,
  });
}

export async function off(bulb: string) {
  await request<JustOk>({
    method: "POST",
    url: `/bulb/${bulb}/off`,
  });
}

export async function setName(bulb: string, name: string) {
  await request<JustOk, SetNameRequest>({
    method: "POST",
    url: `/bulb/${bulb}/setName`,
    data: { name },
  });
}
