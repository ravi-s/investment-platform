import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { AuthenticationService } from "../services/authentication.js";
import type { SessionService } from "../services/session.js";
import type { UserService } from "../services/user.js";
import { authenticationGuard } from "./authentication-guard.ts";

interface AuthenticationRouteOptions {
    authenticationService: AuthenticationService;
    sessionService: SessionService;
    userService: Pick<UserService, "getUser">;
}

const loginSchema = z.object({
    email: z.email(),
    password: z.string().min(1),
});

export const authenticationRoutes: FastifyPluginAsync<
    AuthenticationRouteOptions
> = async (app, { authenticationService, sessionService, userService }) => {
    app.get(
        "/api/auth/me",
        {
            preHandler: authenticationGuard(sessionService),
        },
        async (request, reply) => {
            const userId = request.authenticatedUserId;

            if (userId === null) {
                return reply.code(401).send({
                    error: "Authentication required",
                });
            }

            const user = userService.getUser(userId);

            if (!user) {
                return reply.code(404).send({
                    error: "User not found",
                });
            }

            return reply.send({ user });
        },
    );

    app.post("/api/auth/logout", async (request, reply) => {
        const token = request.cookies?.session;

        if (token) {
            sessionService.revokeSession(token);
        }

        reply.clearCookie("session", {
            httpOnly: true,
            sameSite: "lax",
            path: "/",
            secure: process.env.NODE_ENV === "production",
        });

        return reply.code(204).send();
    });

    app.post("/api/auth/login", async (request, reply) => {
        const parsed = loginSchema.safeParse(request.body);

        if (!parsed.success) {
            return reply.code(400).send({
                error: "Invalid request body",
            });
        }

        const { email, password } = parsed.data;

        let user;

        try {
            user = await authenticationService.authenticate(email, password);
        } catch (error) {
            if (
                error instanceof Error &&
                error.message === "Invalid email or password"
            ) {
                return reply.code(401).send({
                    error: "Invalid email or password",
                });
            }

            throw error;
        }

        const session = sessionService.createSession(user.id);

        reply.setCookie("session", session.token, {
            httpOnly: true,
            sameSite: "lax",
            path: "/",
            expires: new Date(session.expiresAt),
            secure: process.env.NODE_ENV === "production",
        });

        return reply.code(200).send({
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
            },
        });
    });
};