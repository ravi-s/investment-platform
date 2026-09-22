import db from "../db/database.js";

export class UserRepository {
    create(name: string, email: string) {
        const result = db
            .prepare(`
                INSERT INTO users (name, email)
                VALUES (?, ?)
            `)
            .run(name, email);

        return this.findById(Number(result.lastInsertRowid));
    }

    findById(id: number) {
        return db
            .prepare(`
                SELECT id, name, email
                FROM users
                WHERE id = ?
            `)
            .get(id);
    }
}