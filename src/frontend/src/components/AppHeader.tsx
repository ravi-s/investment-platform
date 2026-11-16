import { useState } from "react";
import { useNavigate } from "react-router";

import { useAuth } from "../features/authentication/useAuth";
import Button from "./Button";

function AppHeader() {
	const { user, logout } = useAuth();
	const navigate = useNavigate();
	const [isLoggingOut, setIsLoggingOut] = useState(false);
	const [error, setError] = useState("");

	async function handleLogout() {
		setIsLoggingOut(true);
		setError("");

		try {
			await logout();
			navigate("/login");
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "Unable to log out. Please try again.",
			);
		} finally {
			setIsLoggingOut(false);
		}
	}

	return (
		<header className="border-b border-slate-200 bg-white">
			<div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
				<div className="flex flex-wrap items-center justify-between gap-4">
					<h1 className="text-xl font-semibold">Investment Platform</h1>
					{user && (
						<div className="flex items-center gap-4">
							<span className="text-sm text-slate-700">{user.name}</span>
							<Button
								variant="secondary"
								disabled={isLoggingOut}
								onClick={handleLogout}
							>
								{isLoggingOut ? "Logging out..." : "Logout"}
							</Button>
						</div>
					)}
				</div>
				{error && (
					<p className="mt-2 text-sm text-red-600" role="alert">
						{error}
					</p>
				)}
			</div>
		</header>
	);
}

export default AppHeader;
