
-- Migration 016: Seed initial mutual fund securities

INSERT INTO securities (name, isin)
SELECT seed.name, seed.isin
FROM (
    SELECT 'Axis Liquid Fund - Direct Plan' AS name,
           'INF846K01CX4' AS isin
    UNION ALL
    SELECT 'Edelweiss Arbitrage Fund - Direct Plan Growth Option',
           'INF754K01EA4'
    UNION ALL
    SELECT 'HDFC Money Market Fund - Direct Plan - Growth',
           'INF179KB1HU9'
    UNION ALL
    SELECT 'HDFC Short Term Debt Fund - Direct Plan - Growth Option',
           'INF179K01YM7'
    UNION ALL
    SELECT 'ICICI Prudential Balanced Advantage Fund - Direct Plan - Growth',
           'INF109K012B0'
    UNION ALL
    SELECT 'ICICI Prudential Income Plus Arbitrage Omni FoF - Direct Plan - Growth',
           'INF109K01W82'
    UNION ALL
    SELECT 'Kotak Bond Short Term Fund - Direct Plan',
           'INF174K01JI7'
    UNION ALL
    SELECT 'Motilal Oswal S&P 500 Index Fund - Direct Plan',
           'INF247L01AG2'
    UNION ALL
    SELECT 'Mirae Asset Equity Savings Fund - Direct Plan',
           'INF769K01EK1'
    UNION ALL
    SELECT 'Parag Parikh Flexi Cap Fund - Direct Plan Growth',
           'INF879O01027'
) AS seed
WHERE NOT EXISTS (
    SELECT 1
    FROM securities existing
    WHERE existing.isin = seed.isin
);
