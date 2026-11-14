import { Route, Routes } from "react-router";

import HomePage from "../pages/HomePage";
import NotFoundPage from "../pages/NotFoundPage";
import LoginPage from "../features/authentication/LoginPage";
import PortfoliosPage from "../features/portfolios/PortfoliosPage";
import MainLayout from "../layouts/MainLayout";
import RegisterPage from "../features/authentication/RegisterPage";
import { ProtectedRoute } from "../features/authentication/ProtectedRoute";

function App() {
	return (
		<Routes>
			<Route element={<MainLayout />}>
				<Route index element={<HomePage />} />
				<Route path="/login" element={<LoginPage />} />
				<Route path="/register" element={<RegisterPage />} />
				<Route element={<ProtectedRoute />}>
					<Route path="/portfolios" element={<PortfoliosPage />} />
				</Route>
				<Route path="*" element={<NotFoundPage />} />
			</Route>
		</Routes>
	);
}

export default App;
