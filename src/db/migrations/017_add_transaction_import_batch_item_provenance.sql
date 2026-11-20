ALTER TABLE transaction_import_batch_items
    ADD COLUMN source_file TEXT;

ALTER TABLE transaction_import_batch_items
    ADD COLUMN source_row_number INTEGER;

ALTER TABLE transaction_import_batch_items
    ADD COLUMN isin TEXT;

ALTER TABLE transaction_import_batch_items
    ADD COLUMN trade_id TEXT;

ALTER TABLE transaction_import_batch_items
    ADD COLUMN order_id TEXT;