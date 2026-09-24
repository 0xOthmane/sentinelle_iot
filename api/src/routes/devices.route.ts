import { Hono } from "hono";
import { DevicesRepo } from "../db/repositories/devices.repo";

const devicesRoute = new Hono();

devicesRoute.get("/", (c) => {
  const repo = new DevicesRepo();
  const devices = repo.findAll();
  return c.json(devices);
});

export { devicesRoute };
