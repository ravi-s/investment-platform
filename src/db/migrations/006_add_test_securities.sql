INSERT INTO securities (name)
VALUES ('Tata Consultancy Services Limited');

INSERT INTO listings (security_id, exchange_id, symbol)
SELECT id, 1, 'TCS'
FROM securities
WHERE name = 'Tata Consultancy Services Limited';

INSERT INTO securities (name)
VALUES ('Infosys Limited');

INSERT INTO listings (security_id, exchange_id, symbol)
SELECT id, 1, 'INFY'
FROM securities
WHERE name = 'Infosys Limited';