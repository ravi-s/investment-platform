import { type FastifyInstance } from "fastify";
import { UserService } from "../services/user.js";
import { CreateUserSchema } from "../contracts/user.js";

const service = new UserService();

export async function userRoutes(app: FastifyInstance) {
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
            result.data.email
        );

        return reply
            .code(201)
            .send(user);
    });

    app.get("/api/users/:id", async (request, reply) => {
        const { id } = request.params as { id: string };

        const user = service.getUser(Number(id));

        if (!user) {
            return reply.code(404).send({
                error: "User not found"
            });
        }

        return user;
    });
}