PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS customer (
  id INTEGER PRIMARY KEY,  -- Internal ID
  entityid TEXT UNIQUE,    -- Entity ID (customer number)
  companyname TEXT,        -- Company Name
  email TEXT,              -- Email
  phone TEXT,              -- Phone
  fax TEXT,                -- Fax
  subsidiary TEXT,         -- Subsidiary
  isinactive INTEGER DEFAULT 0,  -- Is Inactive (0=false, 1=true)
  isperson INTEGER DEFAULT 0,    -- Is Person (0=false, 1=true)
  category TEXT,           -- Category
  salesrep TEXT,           -- Sales Rep
  terms TEXT,              -- Terms
  creditlimit REAL,        -- Credit Limit
  balance REAL DEFAULT 0,  -- Balance
  datecreated TEXT DEFAULT (datetime('now')),  -- Date Created
  lastmodified TEXT DEFAULT (datetime('now')), -- Last Modified
  
  -- Address fields
  billaddr1 TEXT,          -- Billing Address 1
  billaddr2 TEXT,          -- Billing Address 2
  billcity TEXT,           -- Billing City
  billstate TEXT,          -- Billing State
  billzip TEXT,            -- Billing Zip
  billcountry TEXT,        -- Billing Country
  
  shipaddr1 TEXT,          -- Shipping Address 1
  shipaddr2 TEXT,          -- Shipping Address 2
  shipcity TEXT,           -- Shipping City
  shipstate TEXT,          -- Shipping State
  shipzip TEXT,            -- Shipping Zip
  shipcountry TEXT         -- Shipping Country
);

CREATE TABLE IF NOT EXISTS invoice (
  id INTEGER PRIMARY KEY,  -- Internal ID
  tranid TEXT UNIQUE,      -- Transaction ID (invoice number)
  customerid INTEGER NOT NULL,  -- Customer Internal ID
  entity INTEGER NOT NULL,      -- Customer Internal ID (alias)
  status TEXT CHECK (status IN ('Open','Paid','Overdue','Pending Approval','Pending Fulfillment')) NOT NULL,
  total REAL NOT NULL,     -- Total Amount
  subtotal REAL,           -- Subtotal
  taxtotal REAL,           -- Tax Total
  duedate TEXT NOT NULL,   -- Due Date
  trandate TEXT,           -- Transaction Date
  postingperiod TEXT,      -- Posting Period
  memo TEXT,               -- Memo
  terms TEXT,              -- Terms
  location TEXT,           -- Location
  department TEXT,         -- Department
  class TEXT,              -- Class
  subsidiary TEXT,         -- Subsidiary
  currency TEXT DEFAULT 'USD',  -- Currency
  exchangerate REAL DEFAULT 1,  -- Exchange Rate
  datecreated TEXT DEFAULT (datetime('now')),   -- Date Created
  lastmodified TEXT DEFAULT (datetime('now')),  -- Last Modified
  createdby INTEGER,       -- Created By (user ID)
  
  FOREIGN KEY (customerid) REFERENCES customer(id),
  FOREIGN KEY (entity) REFERENCES customer(id)
);

CREATE INDEX IF NOT EXISTS idx_invoice_customer ON invoice(customerid);
CREATE INDEX IF NOT EXISTS idx_invoice_status ON invoice(status);
CREATE INDEX IF NOT EXISTS idx_invoice_due_date ON invoice(duedate);
