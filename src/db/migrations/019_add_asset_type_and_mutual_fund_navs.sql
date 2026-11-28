
-- Migration 019: Add instrument classification and mutual fund NAV history

-- 1. Classify securities independently of their provider.
-- Existing securities default to EQUITY.
ALTER TABLE securities
ADD COLUMN asset_type TEXT NOT NULL DEFAULT 'EQUITY'
CHECK (asset_type IN ('EQUITY', 'ETF', 'MUTUAL_FUND'));

-- 2. Classify the ten existing mutual-fund securities using their ISINs.
UPDATE securities
SET asset_type = 'MUTUAL_FUND'
WHERE isin IN (
    'INF846K01CX4', -- Axis Liquid Fund
    'INF754K01EA4', -- Edelweiss Arbitrage Fund
    'INF179KB1HU9', -- HDFC Money Market Fund
    'INF179K01YM7', -- HDFC Short Term Debt Fund
    'INF109K012B0', -- ICICI Prudential Balanced Advantage Fund
    'INF109K01W82', -- ICICI Prudential Income Plus Arbitrage Omni FoF
    'INF174K01JI7', -- Kotak Bond Short Term Fund
    'INF769K01EK1', -- Mirae Asset Equity Savings Fund
    'INF247L01AG2', -- Motilal Oswal S&P 500 Index Fund
    'INF879O01027'  -- Parag Parikh Flexi Cap Fund
);

-- 3. Persist mutual-fund NAV history separately from exchange prices.
CREATE TABLE mutual_fund_navs (
    id INTEGER PRIMARY KEY,
    security_id INTEGER NOT NULL,
    nav_date TEXT NOT NULL,
    nav REAL NOT NULL CHECK (nav > 0),
    source TEXT NOT NULL,
    fetched_at TEXT NOT NULL,

    FOREIGN KEY (security_id) REFERENCES securities(id),
    UNIQUE (security_id, nav_date)
);

-- 4. Support latest NAV on or before a requested valuation date.
CREATE INDEX idx_mutual_fund_navs_security_date
ON mutual_fund_navs (security_id, nav_date);
