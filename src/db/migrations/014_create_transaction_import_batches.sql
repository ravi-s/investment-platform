CREATE TABLE transaction_import_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    portfolio_id INTEGER NOT NULL,
    content_hash TEXT NOT NULL
        CHECK (length(content_hash) = 64),
    status TEXT NOT NULL DEFAULT 'STAGED'
        CHECK (status IN ('STAGED', 'APPLIED', 'REJECTED')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    applied_at TEXT,

    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (portfolio_id) REFERENCES portfolios(id)
);

CREATE TABLE transaction_import_batch_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id INTEGER NOT NULL,
    source_row INTEGER NOT NULL CHECK (source_row >= 2),
    transaction_date TEXT NOT NULL,
    security_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('BUY', 'SELL')),
    quantity REAL NOT NULL CHECK (quantity > 0),
    price REAL NOT NULL CHECK (price > 0),

    FOREIGN KEY (batch_id)
        REFERENCES transaction_import_batches(id),
    FOREIGN KEY (security_id)
        REFERENCES securities(id),

    UNIQUE (batch_id, source_row)
);

CREATE INDEX idx_import_batch_items_batch
    ON transaction_import_batch_items(batch_id);