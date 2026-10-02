CREATE TABLE investment_events (
id INTEGER PRIMARY KEY,


security_id INTEGER NOT NULL,

event_type TEXT NOT NULL
    CHECK (event_type IN ('DIVIDEND')),

ex_date TEXT NOT NULL,
record_date TEXT NOT NULL,
payment_date TEXT NOT NULL,

amount_per_unit REAL NOT NULL
    CHECK (amount_per_unit > 0),

currency TEXT NOT NULL DEFAULT 'INR',

FOREIGN KEY (security_id)
    REFERENCES securities(id),

CHECK (record_date >= ex_date),
CHECK (payment_date >= ex_date)


);
