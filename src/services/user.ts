import type { CreateUser, User } from "../contracts/user.ts";

import {
    createUser as insertUser,
    findAllUsers,
    findUserById,
} from "../repositories/user.ts";

export function createUser(data: CreateUser): User {
    return insertUser(data);
}

export function getUsers(): User[] {
    return findAllUsers();
}

export function getUserById(id: number): User | undefined {
    return findUserById(id);
}