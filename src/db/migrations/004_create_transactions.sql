CREATE TABLE transactions (
    id INTEGER PRIMARY KEY,
    portfolio_id INTEGER NOT NULL,
    security_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    quantity REAL NOT NULL,
    price REAL NOT NULL,
    transaction_date TEXT NOT NULL,

    FOREIGN KEY (portfolio_id)
        REFERENCES portfolios(id),

    FOREIGN KEY (security_id)
        REFERENCES securities(id),

    CHECK (type IN ('BUY', 'SELL')),
    CHECK (quantity > 0),
    CHECK (price > 0)
);