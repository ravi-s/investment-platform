import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { AuthenticationService } from "../services/authentication.js";
import type { SessionService } from "../services/session.js";

interface AuthenticationRouteOptions {
    authenticationService: AuthenticationService;
    sessionService: SessionService;
}

const loginSchema = z.object({
    email: z.email(),
    password: z.string().min(1),
});

export const authenticationRoutes: FastifyPluginAsync<
    AuthenticationRouteOptions
> = async (app, { authenticationService, sessionService }) => {
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