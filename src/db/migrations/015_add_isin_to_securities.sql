ALTER TABLE securities
ADD COLUMN isin TEXT;

CREATE UNIQUE INDEX idx_securities_isin
ON securities(isin)
WHERE isin IS NOT NULL;