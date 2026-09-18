import type { IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url"
import { UserSchema, CreateUserSchema } from "../contracts/user.ts";
import {
    createUser,
    getUsers,
    getUserById,
} from "../services/user.ts";

import { sendJson } from "../http.ts";

export function handleUserRoute(
    req: IncomingMessage,
    res: ServerResponse,
) {

    if (req.url === "/api/users" && req.method === "GET") {
        const users = getUsers();

        const result = UserSchema.array().safeParse(users);

        if (!result.success) {
            sendJson(res, 500, { error: "Invalid server data" });
            return;
        }

        sendJson(res, 200, result.data);
        return;
    }
    // GET /api/user/:id
    if (req.method === "GET" && req.url?.startsWith("/api/user/")) {
        const url = new URL(req.url ?? "", "http://localhost");
        const idText = url.pathname.split("/")[3];
        const id = Number(idText);

        if (!Number.isInteger(id) || id <= 0) {
            sendJson(res, 400, { error: "Invalid user ID" });
            return;
        }

        const user = getUserById(id);

        if (!user) {
            sendJson(res, 404, { error: "User not found" });
            return;
        }

        const result = UserSchema.safeParse(user);

        if (!result.success) {
            sendJson(res, 500, { error: "Invalid server data" });
            return;
        }

        sendJson(res, 200, result.data);
        return;
    }

    // POST /api/user
    if (req.url === "/api/user" && req.method === "POST") {
        let body = "";

        req.on("data", (chunk) => {
            body += chunk;
        });

        req.on("end", () => {
            // 1. Parse JSON
            let data: unknown;

            try {
                data = JSON.parse(body);
            } catch {
                sendJson(res, 400, { error: "Invalid JSON" });
                return;
            }

            // 2. Validate request data
            const result = CreateUserSchema.safeParse(data);

            if (!result.success) {
                sendJson(res, 400, {
                    error: "Invalid user data",
                    details: result.error,
                });
                return;
            }

            // 3. Create user through the service
            let newUser;

            try {
                newUser = createUser(result.data);
            } catch (error) {
                console.error("Database error:", error);

                sendJson(res, 409, {
                    error: "A user with this email already exists",
                });
                return;
            }

            // 4. Return successful response
            sendJson(res, 201, newUser);
        });

        return;
    }

    // Unknown route
    sendJson(res, 404, { error: "Not found" });
}