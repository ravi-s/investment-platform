import Fastify from "fastify";
import { securityRoutes } from "./routes/security.js";
import { userRoutes } from "./routes/user.js";
import { portfolioRoutes } from "./routes/portfolio.js";
import { holdingRoutes } from "./routes/holding.js";
import { transactionRoutes } from "./routes/transaction.js";

const app = Fastify({
    logger: true,
});

await app.register(securityRoutes);
await app.register(userRoutes);
await app.register(portfolioRoutes);
await app.register(holdingRoutes);
await app.register(transactionRoutes);

app.listen({ port: 3001 }, (err, address) => {
    if (err) {
        app.log.error(err);
        process.exit(1);
    }

    console.log(`Server running at ${address}`);
});