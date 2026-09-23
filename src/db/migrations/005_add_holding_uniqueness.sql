CREATE UNIQUE INDEX idx_holdings_portfolio_security
ON holdings (portfolio_id, security_id);