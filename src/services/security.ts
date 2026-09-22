import { SecurityRepository } from "../repositories/security.js";

const repository = new SecurityRepository();

export class SecurityService {
    getSecurity(id: number) {
        return repository.findById(id);
    }

    getListing(exchangeCode: string, symbol: string) {
        return repository.findListing(exchangeCode, symbol);
    }
}