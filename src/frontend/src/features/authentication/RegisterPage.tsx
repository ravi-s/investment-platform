import { useState } from "react";
import { Link } from "react-router";

import Card from "../../components/Card";
import Button from "../../components/Button";

import { register } from "../../services/auth.service";

function RegisterPage() {
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");

	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");

	async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
		event.preventDefault();

		setIsSubmitting(true);
		setError("");
		setSuccess("");

		try {
			await register(name, email, password);

			setSuccess("Account created successfully. Please log in.");
			setName("");
			setEmail("");
			setPassword("");
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "Unable to create account. Please try again.",
			);
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<div className="mx-auto max-w-md">
			<Card title="Create Account">
				<form onSubmit={handleSubmit} className="space-y-4">
					{error && (
						<p className="text-sm text-red-600" role="alert">
							{error}
						</p>
					)}
					{success && (
						<p className="text-sm text-green-600" role="status">
							{success}
						</p>
					)}
					<div>
						<label htmlFor="name" className="mb-1 block text-sm font-medium">
							Name
						</label>
						<input
							id="name"
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							autoComplete="name"
							required
							placeholder="Enter your name"
							className="w-full rounded-md border border-gray-300 px-3 py-2"
						/>
					</div>
					<div>
						<label htmlFor="email" className="mb-1 block text-sm font-medium">
							Email
						</label>
						<input
							id="email"
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							autoComplete="email"
							required
							placeholder="Enter your email"
							className="w-full rounded-md border border-gray-300 px-3 py-2"
						/>
					</div>
					<div>
						<label
							htmlFor="password"
							className="mb-1 block text-sm font-medium"
						>
							Password
						</label>
						<input
							id="password"
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							autoComplete="new-password"
							required
							placeholder="Create a password"
							className="w-full rounded-md border border-gray-300 px-3 py-2"
						/>
					</div>
					<Button type="submit" disabled={isSubmitting}>
						{isSubmitting ? "Creating account..." : "Create Account"}
					</Button>{" "}
				</form>
				<p className="mt-4 text-center text-sm">
					Already have an account?{" "}
					<Link
						to="/login"
						className="font-medium text-blue-600 hover:underline"
					>
						Login
					</Link>
				</p>
			</Card>
		</div>
	);
}

export default RegisterPage;
