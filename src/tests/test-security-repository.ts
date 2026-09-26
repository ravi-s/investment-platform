import { SecurityRepository } from "../repositories/security.ts";

const repository = new SecurityRepository();

console.log(
    repository.findById(1)
);

console.log(
    repository.findListing("NSE", "RELIANCE")
);

console.log(
    repository.findListing("BSE", "500325")
);