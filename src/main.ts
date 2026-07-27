import cors from "cors";
import express from "express";
import { env } from "./config/env";
import { prisma } from "./infrastructure/database/prisma/client";
import { pingMongo } from "./infrastructure/database/mongo/client";
import { getRabbitChannel } from "./infrastructure/queue/rabbitmq/connection";
import { buildCampaignRouter } from "./presentation/http/campaign.routes";
import { startCampaignMessageConsumer } from "./presentation/workers/campaign-message-consumer";

async function main() {
  await prisma.$connect();
  const channel = await getRabbitChannel();

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use(buildCampaignRouter(channel));

  app.get("/health", async (_req, res) => {
    const [dbOk, mongoOk] = await Promise.all([
      prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
      pingMongo(),
    ]);

    res.json({ status: "ok", service: "campaign-worker", db: dbOk, mongo: mongoOk });
  });

  app.listen(env.PORT, () => {
    console.log(`Campaign-Worker listening on port ${env.PORT}`);
  });

  await startCampaignMessageConsumer(channel);
}

main().catch((error) => {
  console.error("Fatal error during Campaign-Worker bootstrap:", error);
  process.exit(1);
});
