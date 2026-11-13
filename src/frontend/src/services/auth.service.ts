
export interface AuthUser {
    id: number;
    name: string;
    email: string;
}

// Shape returned by the login endpoint on successful authentication.
interface LoginResponse {
    user: AuthUser;
}

interface RegisterResponse {
    user: AuthUser;
}

export async function login(
    email: string,
    password: string,
): Promise<AuthUser> {
    // Submit the credentials and include cookies for session-based authentication.
    const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
    });

    // Read the response body so any server-provided error message can be used.
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Login failed");
    }

    // Extract and return the authenticated user from the response.
    const result = data as LoginResponse;

    return result.user;
}

export async function register(
    name: string,
    email: string,
    password: string,
): Promise<AuthUser> {
    const response = await fetch("/api/users", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Registration failed");
    }

    const result = data as RegisterResponse;

    return result.user;
}
