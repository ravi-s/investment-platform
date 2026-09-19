CREATE TABLE exchanges (
    id INTEGER PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL
);

CREATE TABLE listings (
    id INTEGER PRIMARY KEY,
    security_id INTEGER NOT NULL,
    exchange_id INTEGER NOT NULL,
    symbol TEXT NOT NULL,

    FOREIGN KEY (security_id)
        REFERENCES securities(id),

    FOREIGN KEY (exchange_id)
        REFERENCES exchanges(id),

    UNIQUE (security_id, exchange_id)
);