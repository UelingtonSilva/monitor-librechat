import type { FastifyInstance } from "fastify";
import type { HealthStatus } from "@monitor-librechat/shared";
import { getMongoDb, isMongoConfigured } from "../mongo.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({ status: "ok" }));

  app.get("/ready", async (): Promise<HealthStatus> => {
    let mongoConnected = false;
    if (isMongoConfigured()) {
      try {
        const db = await getMongoDb();
        await db?.command({ ping: 1 });
        mongoConnected = true;
      } catch {
        mongoConnected = false;
      }
    }
    return {
      status: mongoConnected || !isMongoConfigured() ? "ok" : "degraded",
      mongoConnected,
      version: "0.1.0",
    };
  });
}
