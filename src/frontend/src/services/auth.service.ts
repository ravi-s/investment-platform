
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
    // Create an account by sending the registration details to the users endpoint.
    const response = await fetch("/api/users", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, email, password }),
    });

    // Parse the response to expose any server-provided registration error.
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Registration failed");
    }

    // Return the newly registered user from the response payload.
    const result = data as RegisterResponse;

    return result.user;
}


export async function getCurrentUser(): Promise<AuthUser | null> {
    // Check the session cookie to determine whether a user is authenticated.
    const response = await fetch("/api/auth/me", {
        method: "GET",
        credentials: "include",
    });

    if (response.status === 401) {
        // An unauthenticated session is a normal result, not an error.
        return null;
    }

    if (!response.ok) {
        throw new Error("Unable to retrieve authenticated user");
    }

    // Extract the authenticated user returned by the endpoint.
    const data = (await response.json()) as LoginResponse;

    return data.user;
}

export async function logout(): Promise<void> {
    // Ask the server to invalidate the session associated with the cookie.
    const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
    });

    if (!response.ok) {
        // Surface a failure if the server could not end the session.
        throw new Error("Logout failed");
    }
}
