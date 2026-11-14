import { createContext } from "react";
import type { AuthUser } from "../../services/auth.service";

export interface AuthContextType {
    user: AuthUser | null;
    isLoading: boolean;
    initializationError: string | null;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
}

export const AuthContext =
    createContext<AuthContextType | undefined>(undefined);