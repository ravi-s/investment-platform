
import { useEffect, useState, type SubmitEvent } from "react";

import Card from "../../components/Card";
import Button from "../../components/Button";

import {
    getPortfolios,
    createPortfolio,
    type Portfolio,
} from "../../services/portfolio.service";

function PortfoliosPage() {
    const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
    const [name, setName] = useState("");

    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);

    const [error, setError] = useState<string | null>(null);
    const [createError, setCreateError] = useState<string | null>(null);

    useEffect(() => {
        async function loadPortfolios() {
            try {
                const result = await getPortfolios();
                setPortfolios(result);
            } catch (error) {
                setError(
                    error instanceof Error
                        ? error.message
                        : "Unable to load portfolios"
                );
            } finally {
                setIsLoading(false);
            }
        }

        loadPortfolios();
    }, []);

    async function handleCreatePortfolio(
        event: SubmitEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        const portfolioName = name.trim();

        if (!portfolioName) return;

        setIsCreating(true);
        setCreateError(null);

        try {
            const portfolio = await createPortfolio(portfolioName);

            setPortfolios((current) => [...current, portfolio]);
            setName("");
        } catch (error) {
            setCreateError(
                error instanceof Error
                    ? error.message
                    : "Unable to create portfolio"
            );
        } finally {
            setIsCreating(false);
        }
    }

    return (
        <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">

            {/* Page heading */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                    My Portfolios
                </h1>

                <p className="mt-2 text-sm text-slate-500">
                    Manage and monitor your investment portfolios.
                </p>
            </div>

            {/* Create portfolio */}
            <Card title="Create a Portfolio">
                <p className="mb-5 text-sm text-slate-500">
                    Create a portfolio to start organizing your investments.
                </p>

                <form
                    onSubmit={handleCreatePortfolio}
                    className="flex flex-col gap-3 sm:flex-row sm:items-end"
                >
                    <div className="flex-1">
                        <label
                            htmlFor="portfolioName"
                            className="mb-2 block text-sm font-medium text-slate-700"
                        >
                            Portfolio name
                        </label>

                        <input
                            id="portfolioName"
                            type="text"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            placeholder="e.g. Long Term Investments"
                            required
                            className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                    </div>

                    <Button
                        type="submit"
                        disabled={isCreating || !name.trim()}
                    >
                        {isCreating ? "Creating..." : "Create Portfolio"}
                    </Button>
                </form>

                {createError && (
                    <p className="mt-3 text-sm text-red-600" role="alert">
                        {createError}
                    </p>
                )}
            </Card>

            {/* Portfolio list */}
            <section>
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-900">
                        Your Portfolios
                    </h2>

                    <span className="text-sm text-slate-500">
                        {portfolios.length}{" "}
                        {portfolios.length === 1 ? "portfolio" : "portfolios"}
                    </span>
                </div>

                {isLoading ? (
                    <Card>
                        <p className="text-sm text-slate-500">
                            Loading portfolios...
                        </p>
                    </Card>
                ) : error ? (
                    <Card>
                        <p className="text-sm text-red-600" role="alert">
                            {error}
                        </p>
                    </Card>
                ) : portfolios.length === 0 ? (
                    <Card>
                        <div className="py-6 text-center">
                            <h3 className="text-base font-semibold text-slate-800">
                                No portfolios yet
                            </h3>

                            <p className="mt-2 text-sm text-slate-500">
                                Create your first portfolio to get started.
                            </p>
                        </div>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                        {portfolios.map((portfolio) => (
                            <Card key={portfolio.id} title={portfolio.name}>
                                <p className="text-sm text-slate-500">
                                    Portfolio #{portfolio.id}
                                </p>
                            </Card>
                        ))}
                    </div>
                )}
            </section>
        </main>
    );
}

export default PortfoliosPage;
