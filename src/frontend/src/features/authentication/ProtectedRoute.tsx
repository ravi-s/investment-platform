import { Navigate, Outlet } from "react-router";

import { useAuth } from "./useAuth";

export function ProtectedRoute() {
    const {
        isLoading,
        initializationError,
        isAuthenticated,
    } = useAuth();

    if (isLoading) {
        return <p>Checking authentication...</p>;
    }

    if (initializationError) {
        return (
            <p>
                Unable to verify your session:
                {" "}
                {initializationError}
            </p>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return <Outlet />;
}