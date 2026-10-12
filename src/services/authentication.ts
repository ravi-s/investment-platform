import { UserRepository } from "../repositories/user.js";
import { CredentialRepository } from "../repositories/credential.js";
import { PasswordHasher } from "./password-hasher.js";

const INVALID_CREDENTIALS = "Invalid email or password";

export class AuthenticationService {
    constructor(
        private readonly userRepository: Pick<
            UserRepository,
            "findByEmail"
        >,
        private readonly credentialRepository: Pick<
            CredentialRepository,
            "findByUserId"
        >,
        private readonly passwordHasher: Pick<
            PasswordHasher,
            "verify"
        >,
    ) { }

    async authenticate(email: string, password: string) {
        const user = this.userRepository.findByEmail(email);

        if (!user) {
            throw new Error(INVALID_CREDENTIALS);
        }

        const credentials =
            this.credentialRepository.findByUserId(
                (user as { id: number }).id,
            );

        if (!credentials) {
            throw new Error(INVALID_CREDENTIALS);
        }

        const validPassword = await this.passwordHasher.verify(
            password,
            credentials.password_hash,
        );

        if (!validPassword) {
            throw new Error(INVALID_CREDENTIALS);
        }

        return user;
    }
}
