CREATE TABLE transaction_imports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    portfolio_id INTEGER NOT NULL,
    content_hash TEXT NOT NULL
        CHECK (length(content_hash) = 64),
    imported_at TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (user_id)
        REFERENCES users(id),

    FOREIGN KEY (portfolio_id)
        REFERENCES portfolios(id),

    UNIQUE (user_id, portfolio_id, content_hash)
);