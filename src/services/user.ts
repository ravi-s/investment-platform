
import type Database from "better-sqlite3";
import { UserRepository } from "../repositories/user.js";
import db from "../db/database.js";

export class UserService {
    private readonly repository: UserRepository;

    constructor(database: Database.Database = db) {
        this.repository = new UserRepository(database);
    }

    createUser(name: string, email: string) {
        return this.repository.create(name, email);
    }

    getUser(id: number) {
        return this.repository.findById(id);
    }
}

export default new UserService();