import { describe, expect, it, vi } from "vitest";

import { AuthenticationService } from "../services/authentication.js";

describe("AuthenticationService", () => {
    const passwordHasher = {
        verify: vi.fn(),
    };

    const credentialRepository = {
        findByUserId: vi.fn(),
    };

    const userRepository = {
        findByEmail: vi.fn(),
    };

    const service = new AuthenticationService(
        userRepository,
        credentialRepository,
        passwordHasher,
    );

    it("authenticates a user with valid credentials", async () => {
        userRepository.findByEmail.mockReturnValue({
            id: 1,
            name: "Test User",
            email: "test@example.com",
        });

        credentialRepository.findByUserId.mockReturnValue({
            user_id: 1,
            password_hash: "$argon2id$test-hash",
        });

        passwordHasher.verify.mockResolvedValue(true);

        await expect(
            service.authenticate("test@example.com", "correct-password"),
        ).resolves.toMatchObject({
            id: 1,
            name: "Test User",
            email: "test@example.com",
        });
    });

    it("rejects an incorrect password", async () => {
        userRepository.findByEmail.mockReturnValue({
            id: 1,
            name: "Test User",
            email: "test@example.com",
        });

        credentialRepository.findByUserId.mockReturnValue({
            user_id: 1,
            password_hash: "$argon2id$test-hash",
        });

        passwordHasher.verify.mockResolvedValue(false);

        await expect(
            service.authenticate("test@example.com", "wrong-password"),
        ).rejects.toThrow("Invalid email or password");
    });

    it("rejects an unknown email with a generic error", async () => {
        userRepository.findByEmail.mockReturnValue(undefined);

        await expect(
            service.authenticate("unknown@example.com", "some-password"),
        ).rejects.toThrow("Invalid email or password");
    });

    it("rejects a user who has no credentials", async () => {
        userRepository.findByEmail.mockReturnValue({
            id: 2,
            name: "Unconfigured User",
            email: "unconfigured@example.com",
        });

        credentialRepository.findByUserId.mockReturnValue(undefined);

        await expect(
            service.authenticate(
                "unconfigured@example.com",
                "some-password",
            ),
        ).rejects.toThrow("Invalid email or password");
    });

    it("uses the same error message for invalid credentials", async () => {
        userRepository.findByEmail.mockReturnValue(undefined);

        let unknownEmailError: string | undefined;

        try {
            await service.authenticate(
                "unknown@example.com",
                "some-password",
            );
        } catch (error) {
            unknownEmailError =
                error instanceof Error ? error.message : undefined;
        }

        userRepository.findByEmail.mockReturnValue({
            id: 1,
            name: "Test User",
            email: "test@example.com",
        });

        credentialRepository.findByUserId.mockReturnValue({
            user_id: 1,
            password_hash: "$argon2id$test-hash",
        });

        passwordHasher.verify.mockResolvedValue(false);

        let wrongPasswordError: string | undefined;

        try {
            await service.authenticate(
                "test@example.com",
                "wrong-password",
            );
        } catch (error) {
            wrongPasswordError =
                error instanceof Error ? error.message : undefined;
        }

        expect(unknownEmailError).toBe("Invalid email or password");
        expect(wrongPasswordError).toBe("Invalid email or password");
    });
});
