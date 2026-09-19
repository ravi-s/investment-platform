CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE
);

CREATE TABLE portfolios (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
);

CREATE TABLE securities (
    id INTEGER PRIMARY KEY,
    symbol TEXT NOT NULL,
    name TEXT NOT NULL
);

CREATE TABLE holdings (
    id INTEGER PRIMARY KEY,
    portfolio_id INTEGER NOT NULL,
    security_id INTEGER NOT NULL,
    quantity REAL NOT NULL,

    FOREIGN KEY (portfolio_id)
        REFERENCES portfolios(id),

    FOREIGN KEY (security_id)
        REFERENCES securities(id)
);