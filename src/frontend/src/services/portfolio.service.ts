export interface Portfolio {
    id: number;
    user_id: number;
    name: string;
}

export async function getPortfolios(): Promise<Portfolio[]> {
    const response = await fetch("/api/portfolios", {
        method: "GET",
        credentials: "include",
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Unable to retrieve portfolios");
    }

    return data as Portfolio[];
}

export async function createPortfolio(name: string): Promise<Portfolio> {
    const response = await fetch("/api/portfolios", {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Unable to create portfolio");
    }

    return data as Portfolio;
}