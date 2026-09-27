CREATE TABLE market_prices (
    id INTEGER PRIMARY KEY,
    listing_id INTEGER NOT NULL,
    price_date TEXT NOT NULL,
    close_price REAL NOT NULL,

    FOREIGN KEY (listing_id)
        REFERENCES listings(id),

    UNIQUE (listing_id, price_date)
);

CREATE INDEX idx_market_prices_listing_date
ON market_prices(listing_id, price_date);