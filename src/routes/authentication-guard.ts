import type {
    FastifyReply,
    FastifyRequest,
} from "fastify";
import type { SessionService } from "../services/session.js";

declare module "fastify" {
    interface FastifyRequest {
        /** User ID set after successful authentication; otherwise null. */
        authenticatedUserId: number | null;
    }
}

/**
 * Creates a Fastify hook that authenticates requests from the session cookie.
 * A valid session attaches its user ID to the request; a missing or invalid
 * session receives a 401 response.
 */
export function authenticationGuard(
    sessionService: SessionService,
) {
    return async function requireAuthentication(
        request: FastifyRequest,
        reply: FastifyReply,
    ) {
        // Default to unauthenticated before attempting session validation.
        request.authenticatedUserId = null;

        const token = request.cookies?.session;

        // Without a session cookie, there is no token to validate.
        if (!token) {
            return reply.code(401).send({
                error: "Authentication required",
            });
        }

        try {
            // Use the validated session to identify the user for later handlers.
            const session = sessionService.validateSession(token);
            request.authenticatedUserId = session.user_id;
        } catch {
            // Keep all session-validation failures private and return one response.
            return reply.code(401).send({
                error: "Authentication required",
            });
        }
    };
}