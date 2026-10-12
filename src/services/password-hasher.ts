import argon2 from "argon2";

/** Hashes passwords with Argon2id and verifies stored password hashes. */
export class PasswordHasher {
    /** Creates an Argon2id hash for the supplied password. */
    async hash(password: string): Promise<string> {
        return argon2.hash(password, {
            type: argon2.argon2id,
        });
    }

    /** Returns false if the password does not match or the hash is invalid. */
    async verify(
        password: string,
        hash: string,
    ): Promise<boolean> {
        try {
            return await argon2.verify(hash, password);
        } catch {
            return false;
        }
    }
}
