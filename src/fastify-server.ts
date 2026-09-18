import Fastify from "fastify";
import { createUser, getUserById, getUsers } from "./services/user.ts";
import { CreateUserSchema } from "./contracts/user.ts";

const app = Fastify({
    logger: true,
});



app.get("/api/users", async () => {
    const users = getUsers();
    return users;
});

app.get<{ Params: { id: string } }>(
    "/api/users/:id",
    async (request, reply) => {
        const id = Number(request.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return reply
                .code(400)
                .send({ error: "Invalid user ID" });
        }

        const user = getUserById(id);

        if (!user) {
            return reply
                .code(404)
                .send({ error: "User not found" });
        }

        return user;
    },
);

app.post("/api/users", async (request, reply) => {
    const result = CreateUserSchema.safeParse(request.body);

    if (!result.success) {
        return reply
            .code(400)
            .send({
                error: "Invalid user data",
                details: result.error,
            });
    }

    try {
        const newUser = createUser(result.data);

        return reply
            .code(201)
            .send(newUser);
    } catch (error) {
        console.error("Database error:", error);

        return reply
            .code(409)
            .send({
                error: "A user with this email already exists",
            });
    }
});

app.listen({ port: 3001 }, (err, address) => {
    if (err) {
        app.log.error(err);
        process.exit(1);
    }

    console.log(`Server running at ${address}`);
});