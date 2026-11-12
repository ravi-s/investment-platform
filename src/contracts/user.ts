import { z } from "zod";

export const CreateUserSchema = z.object({
    name: z.string().min(1),
    email: z.email(),
    password: z.string().min(8),
});

export type CreateUser = z.infer<typeof CreateUserSchema>;