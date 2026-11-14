
import {
    useEffect,
    useState,
} from "react";

import type { ReactNode } from "react";

import type { AuthUser } from "../../services/auth.service";

import {
    getCurrentUser,
    login as loginRequest,
    logout as logoutRequest,
} from "../../services/auth.service";

import { AuthContext } from "./AuthContext";
import type { AuthContextType } from "./AuthContext";

interface AuthProviderProps {
    children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [initializationError, setInitializationError] =
        useState<string | null>(null);

    // Restore an existing session when the application starts.
    useEffect(() => {
        let isMounted = true;

        async function restoreSession() {
            try {
                const currentUser = await getCurrentUser();

                if (isMounted) {
                    setUser(currentUser);
                }
            } catch (error) {
                if (isMounted) {
                    setInitializationError(
                        error instanceof Error
                            ? error.message
                            : "Unable to restore session",
                    );
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        }

        restoreSession();

        return () => {
            isMounted = false;
        };
    }, []);

    // Authenticate and update shared application state.
    async function handleLogin(email: string, password: string) {
        const authenticatedUser = await loginRequest(email, password);

        setUser(authenticatedUser);
        setInitializationError(null);
    }

    // Clear shared state only after successful server-side logout.
    async function handleLogout() {
        await logoutRequest();

        setUser(null);
        setInitializationError(null);
    }

    const value: AuthContextType = {
        user,
        isLoading,
        initializationError,
        isAuthenticated: user !== null,
        login: handleLogin,
        logout: handleLogout,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

