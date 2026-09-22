import { UserRepository } from "../repositories/user.js";

const repository = new UserRepository();

export class UserService {
    createUser(name: string, email: string) {
        return repository.create(name, email);
    }

    getUser(id: number) {
        return repository.findById(id);
    }
}