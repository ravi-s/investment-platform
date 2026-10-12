import { describe, it, expect } from "vitest";
import { PasswordHasher } from "../services/password-hasher.js";

describe("PasswordHasher", () => {
    const passwordHasher = new PasswordHasher();

    it("does not store the original password as the hash", async () => {
        const password = "TestPassword!2026";

        const hash = await passwordHasher.hash(password);

        expect(hash).not.toBe(password);
    });

    it("generates an Argon2id hash", async () => {
        const hash = await passwordHasher.hash("TestPassword!2026");

        expect(hash).toMatch(/^\$argon2id\$/);
    });

    it("verifies the correct password", async () => {
        const password = "TestPassword!2026";
        const hash = await passwordHasher.hash(password);

        await expect(
            passwordHasher.verify(password, hash)
        ).resolves.toBe(true);
    });

    it("rejects an incorrect password", async () => {
        const hash = await passwordHasher.hash("CorrectPassword!2026");

        await expect(
            passwordHasher.verify("IncorrectPassword!2026", hash)
        ).resolves.toBe(false);
    });

    it("rejects a malformed hash without throwing", async () => {
        await expect(
            passwordHasher.verify("TestPassword!2026", "not-a-valid-hash")
        ).resolves.toBe(false);
    });
});
