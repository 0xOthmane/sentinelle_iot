import { Hono } from "hono";
import { AlertStatesRepo } from "../db/repositories/alertStates.repo";

const alertsRoute = new Hono();

// GET /devices/:id/alerts/active → alerts fired but not yet cleared.
// Lets a (re)connecting app resync missed WS "alert" frames.
alertsRoute.get("/:id/alerts/active", (c) => {
  const deviceId = c.req.param("id");
  const repo = new AlertStatesRepo();
  const alerts = repo.getActive(deviceId).map((s) => ({
    device: s.device,
    kind: s.kind,
    value: s.value,
    threshold: s.threshold,
    ts: s.updatedTs,
  }));
  return c.json(alerts);
});

export { alertsRoute };
