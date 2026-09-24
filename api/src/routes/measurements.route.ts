import { Hono } from "hono";
import { AggregationService } from "../services/aggregation.service";
import { measurementsQuerySchema } from "../utils/validation";

const measurementsRoute = new Hono();

measurementsRoute.get("/:id/measurements", (c) => {
  const deviceId = c.req.param("id");

  const rawQuery = {
    from: c.req.query("from"),
    to: c.req.query("to"),
    step: c.req.query("step"),
  };

  const cleanQuery = Object.fromEntries(
    Object.entries(rawQuery).filter(([_, v]) => v !== undefined),
  );

  const parsed = measurementsQuerySchema.safeParse(cleanQuery);

  if (!parsed.success) {
    return c.json(
      {
        error: "Invalid query parameters",
        details: parsed.error.issues,
      },
      400,
    );
  }

  const { from, to, step } = parsed.data;

  const service = new AggregationService();
  const measurements = service.getMeasurements(deviceId, from, to, step);

  return c.json(measurements);
});

export { measurementsRoute };
