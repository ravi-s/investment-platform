import Card from "../../components/Card";
import Button from "../../components/Button";

import { useState } from "react";

import { login } from "../../services/auth.service";
function LoginPage() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState("");

	async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
		event.preventDefault();

		setIsSubmitting(true);
		setError("");

		try {
			const user = await login(email, password);

			console.log("Login successful:", user);
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "Unable to log in. Please try again.",
			);
		} finally {
			setIsSubmitting(false);
		}
	}
	return (
		<div className="mx-auto max-w-md">
			<Card title="Login">
				<form onSubmit={handleSubmit} className="space-y-4">
					{error && (
						<p className="text-sm text-red-600" role="alert">
							{error}
						</p>
					)}
					<div>
						<label
							htmlFor="email"
							className="mb-1 block text-sm font-medium text-slate-700"
						>
							Email
						</label>

						<input
							id="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							type="email"
							autoComplete="email"
							required
							placeholder="Enter your email"
							className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
						/>
					</div>

					<div>
						<label
							htmlFor="password"
							className="mb-1 block text-sm font-medium text-slate-700"
						>
							Password
						</label>

						<input
							id="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							type="password"
							autoComplete="current-password"
							required
							placeholder="Enter your password"
							className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
						/>
					</div>

					<Button type="submit" disabled={isSubmitting}>
						{isSubmitting ? "Logging in..." : "Login"}
					</Button>
				</form>
			</Card>
		</div>
	);
}

export default LoginPage;
