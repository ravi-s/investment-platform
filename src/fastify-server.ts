import Fastify from "fastify";
// import type { FastifyPluginAsync } from "fastify";
import { HoldingService } from "./services/holding.ts";

import cookie from "@fastify/cookie";

import { PasswordHasher } from "./services/password-hasher.js";

import { UserRepository } from "./repositories/user.js";
import { CredentialRepository } from "./repositories/credential.js";
import { SessionRepository } from "./repositories/session.js";


import { securityRoutes } from "./routes/security.js";
import { userRoutes } from "./routes/user.js";
import { portfolioRoutes } from "./routes/portfolio.js";
import { holdingRoutes } from "./routes/holding.js";
import { transactionRoutes } from "./routes/transaction.js";
import db from "./db/database.js";
import { TransactionService } from "./services/transaction.js";
import { authenticationRoutes } from "./routes/authentication.ts";
import { AuthenticationService } from "./services/authentication.js";
import { SessionService } from "./services/session.js";
import { UserService } from "./services/user.ts";

const app = Fastify({
    logger: true,
});


const userRepository = new UserRepository();
const credentialRepository = new CredentialRepository(db);
const sessionRepository = new SessionRepository(db);

const passwordHasher = new PasswordHasher();

const authenticationService = new AuthenticationService(
    userRepository,
    credentialRepository,
    passwordHasher,
);

const sessionService = new SessionService(sessionRepository);

await app.register(cookie);

await app.register(securityRoutes);
await app.register(userRoutes, {
    service: new UserService(db),
    sessionService,
});
await app.register(portfolioRoutes, {
    sessionService,
});
await app.register(holdingRoutes, {
    service: new HoldingService(db),
    sessionService,
});
await app.register(transactionRoutes, {
    service: new TransactionService(db),
    sessionService,
});

// Register authentication routes after the cookie plugin.
await app.register(authenticationRoutes, {
    authenticationService,
    sessionService
});

app.listen({ port: 3001 }, (err, address) => {
    if (err) {
        app.log.error(err);
        process.exit(1);
    }

    console.log(`Server running at ${address}`);
});