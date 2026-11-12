
import type Database from "better-sqlite3";
import db from "../db/database.js";
import { UserRepository } from "../repositories/user.js";
import { CredentialRepository } from "../repositories/credential.js";
import { PasswordHasher } from "./password-hasher.js";

export class UserService {
    private readonly repository: UserRepository;
    private readonly credentialRepository: CredentialRepository;
    private readonly passwordHasher: PasswordHasher;
    private readonly database: Database.Database;

    constructor(
        database: Database.Database = db,
        passwordHasher: PasswordHasher = new PasswordHasher(),
    ) {
        this.database = database;
        this.repository = new UserRepository(database);
        this.credentialRepository = new CredentialRepository(database);
        this.passwordHasher = passwordHasher;
    }

    /* createUser(name: string, email: string) {
        return this.repository.create(name, email);
    } */

    async registerUser(name: string, email: string, password: string) {
        // Hash asynchronously before opening the synchronous transaction.
        const passwordHash = await this.passwordHasher.hash(password);

        const register = this.database.transaction(() => {
            const user = this.repository.create(name, email);

            if (!user) {
                throw new Error("User creation failed");
            }

            this.credentialRepository.create(user.id, passwordHash);

            return user;
        });

        return register();
    }

    getUser(id: number) {
        return this.repository.findById(id);
    }
}

export default new UserService();
