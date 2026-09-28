import { SecurityRepository } from "../repositories/security.js";
import db from "../db/database.js";
const repository = new SecurityRepository(db);

export class SecurityService {
    getSecurity(id: number) {
        return repository.findById(id);
    }

    getListing(exchangeCode: string, symbol: string) {
        return repository.findListing(exchangeCode, symbol);
    }
}