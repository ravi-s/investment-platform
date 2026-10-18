
import { type FastifyInstance } from "fastify";
import { UserService } from "../services/user.js";
import { SessionService } from "../services/session.js";
import { authenticationGuard } from "./authentication-guard.ts";
import { CreateUserSchema } from "../contracts/user.js";

type UserRouteOptions = {
    service: UserService;
    sessionService: SessionService;
};

export async function userRoutes(
    app: FastifyInstance,
    options: UserRouteOptions,
) {
    const { service, sessionService } = options;

    // Public registration: validate before creating the user.
    app.post("/api/users", async (request, reply) => {
        const result = CreateUserSchema.safeParse(request.body);

        if (!result.success) {
            return reply.code(400).send({
                error: "Invalid user data",
                details: result.error,
            });
        }

        const user = service.createUser(
            result.data.name,
            result.data.email,
        );

        return reply.code(201).send(user);
    });

    // User lookup requires authentication.
    app.get(
        "/api/users/:id",
        {
            preHandler: authenticationGuard(sessionService),
        },
        async (request, reply) => {
            const { id } = request.params as { id: string };
            const requestedUserId = Number(id);

            if (requestedUserId !== request.authenticatedUserId) {
                return reply.code(404).send({
                    error: "User not found",
                });
            }

            const user = service.getUser(requestedUserId);

            if (!user) {
                return reply.code(404).send({
                    error: "User not found",
                });
            }

            return user;
        },
    );
}
