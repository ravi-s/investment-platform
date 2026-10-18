import type Database from "better-sqlite3";
import { SecurityRepository } from "../repositories/security.js";
import db from "../db/database.js";

export class SecurityService {
    private readonly repository: SecurityRepository;

    constructor(database: Database.Database = db) {
        this.repository = new SecurityRepository(database);
    }

    getSecurity(id: number) {
        return this.repository.findById(id);
    }

    getListing(exchangeCode: string, symbol: string) {
        return this.repository.findListing(exchangeCode, symbol);
    }
}
