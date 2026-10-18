
import type Database from "better-sqlite3";

import db from "../db/database.js";

export class UserRepository {
    constructor(private readonly database: Database.Database = db) { }

    create(name: string, email: string) {
        const result = this.database
            .prepare(`
                INSERT INTO users (name, email)
                VALUES (?, ?)
            `)
            .run(name, email);

        return this.findById(Number(result.lastInsertRowid));
    }

    findById(id: number) {
        return this.database
            .prepare(`
                SELECT id, name, email
                FROM users
                WHERE id = ?
            `)
            .get(id) as
            | { id: number; name: string; email: string }
            | undefined;
    }

    findByEmail(email: string) {
        return this.database
            .prepare(`
                SELECT id, name, email
                FROM users
                WHERE email = ?
            `)
            .get(email) as
            | { id: number; name: string; email: string }
            | undefined;
    }
}
