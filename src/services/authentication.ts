import { UserRepository } from "../repositories/user.js";
import { CredentialRepository } from "../repositories/credential.js";
import { PasswordHasher } from "./password-hasher.js";

const INVALID_CREDENTIALS = "Invalid email or password";

/**
 * Coordinates user lookup, credential lookup, and password verification to
 * authenticate a user.
 *
 * Dependencies are limited to the methods required by this service, allowing
 * implementations to be replaced with test doubles or alternative adapters.
 */
export class AuthenticationService {
    /**
     * Creates the service with its required data-access and password-hashing
     * dependencies.
     *
     * @param userRepository - Finds users by their email address.
     * @param credentialRepository - Finds stored credentials for a user ID.
     * @param passwordHasher - Verifies a supplied password against a stored
     * password hash.
     */
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

    /**
     * Authenticates a user with an email address and plaintext password.
     *
     * The user is looked up first, followed by that user's credentials. The
     * password hasher then checks the supplied password against the stored
     * hash. A single error message is used for all failed checks so callers
     * cannot distinguish an unknown email from missing credentials or an
     * incorrect password.
     *
     * @param email - Email address identifying the account.
     * @param password - Plaintext password to verify; it is not returned.
     * @returns The user record when authentication succeeds.
     * @throws {Error} With the invalid-credentials message if no user or
     * credentials are found, or if password verification fails.
     */
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
