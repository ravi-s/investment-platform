-- 011_add_stock_split_to_transactions.sql

CREATE TABLE transactions_new (
    id INTEGER PRIMARY KEY,
    portfolio_id INTEGER NOT NULL,
    security_id INTEGER NOT NULL,
    type TEXT NOT NULL,

    quantity REAL,
    price REAL,

    split_numerator INTEGER,
    split_denominator INTEGER,

    transaction_date TEXT NOT NULL,

    FOREIGN KEY (portfolio_id)
        REFERENCES portfolios(id),

    FOREIGN KEY (security_id)
        REFERENCES securities(id),

    CHECK (
        (
            type IN ('BUY', 'SELL')
            AND quantity IS NOT NULL
            AND quantity > 0
            AND price IS NOT NULL
            AND price > 0
            AND split_numerator IS NULL
            AND split_denominator IS NULL
        )
        OR
        (
            type = 'SPLIT'
            AND quantity IS NULL
            AND price IS NULL
            AND split_numerator IS NOT NULL
            AND split_numerator > 0
            AND split_denominator IS NOT NULL
            AND split_denominator > 0
        )
    )
);

INSERT INTO transactions_new (
    id,
    portfolio_id,
    security_id,
    type,
    quantity,
    price,
    split_numerator,
    split_denominator,
    transaction_date
)
SELECT
    id,
    portfolio_id,
    security_id,
    type,
    quantity,
    price,
    NULL,
    NULL,
    transaction_date
FROM transactions;

DROP TABLE transactions;

ALTER TABLE transactions_new
RENAME TO transactions;