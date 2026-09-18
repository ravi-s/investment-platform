import { db } from "../database.ts";
import type { CreateUser, User } from "../contracts/user.ts";

// For creating a new user
export function createUser(data: CreateUser): User {
    const statement = db.prepare(`
    INSERT INTO users (name, email)
    VALUES (?, ?)
  `);

    const result = statement.run(data.name, data.email);

    return {
        id: Number(result.lastInsertRowid),
        name: data.name,
        email: data.email,
    };
}
// For getting all users
export function findAllUsers(): User[] {
    const statement = db.prepare(`
        SELECT id, name, email
        FROM users
        ORDER BY id
    `);

    return statement.all() as User[];
}

// For getting a user by ID
export function findUserById(id: number): User | undefined {
    const statement = db.prepare(`
        SELECT id, name, email
        FROM users
        WHERE id = ?
    `);

    return statement.get(id) as User | undefined;
}