import Database from "better-sqlite3";
import fs from "fs";
import { faker } from "@faker-js/faker";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbFile = "data.db";

// Remove existing database
if (fs.existsSync(dbFile)) {
  fs.unlinkSync(dbFile);
}

const db = new Database(dbFile);

// Use the local schema.sql file
const schemaPath = join(__dirname, "schema.sql");
console.log("Loading schema from:", schemaPath);

if (!fs.existsSync(schemaPath)) {
  throw new Error("Schema file not found at: " + schemaPath);
}

const schemaSQL = fs.readFileSync(schemaPath, "utf-8");
console.log("Executing schema...");
db.exec(schemaSQL);

const statuses = ["Open", "Paid", "Overdue"];

const insCust = db.prepare(`
  INSERT INTO customer (entityid, companyname, email, subsidiary, phone, balance, billaddr1, billcity, billstate, billzip, billcountry, isinactive)
  VALUES (@entityid, @companyname, @email, @subsidiary, @phone, @balance, @billaddr1, @billcity, @billstate, @billzip, @billcountry, @isinactive)
`);

const insInv = db.prepare(`
  INSERT INTO invoice (tranid, customerid, entity, status, total, duedate)
  VALUES (@tranid, @customerid, @entity, @status, @total, @duedate)
`);

console.log("Creating sample customers and invoices...");

db.transaction(() => {
  // Create 500 customers
  for (let i = 1; i <= 500; i++) {
    const customerData = {
      entityid: `CUST${String(i).padStart(4, "0")}`,
      companyname: faker.company.name(),
      email: faker.internet.email().toLowerCase(),
      subsidiary: faker.location.country(),
      phone: faker.phone.number(),
      balance: Number(
        faker.number.float({ min: 0, max: 50000, fractionDigits: 2 }).toFixed(2)
      ),
      billaddr1: faker.location.streetAddress(),
      billcity: faker.location.city(),
      billstate: faker.location.state(),
      billzip: faker.location.zipCode(),
      billcountry: faker.location.country(),
      isinactive: 0, // All customers are active
    };
    insCust.run(customerData);
  }

  // Create 2000 invoices
  const pickId = db.prepare(
    "SELECT id FROM customer ORDER BY RANDOM() LIMIT 1"
  );
  for (let i = 1; i <= 2000; i++) {
    const { id: customerid } = pickId.get();
    const status = faker.helpers.arrayElement(statuses);
    const total = Number(
      faker.number.float({ min: 50, max: 100000, fractionDigits: 2 }).toFixed(2)
    );

    const daysOffset = faker.number.int({ min: -120, max: 60 });
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    const duedate = d.toISOString().slice(0, 10);

    const invoiceData = {
      tranid: `INV${String(i).padStart(6, "0")}`,
      customerid,
      entity: customerid, // entity is an alias for customerid
      status,
      total,
      duedate,
    };
    insInv.run(invoiceData);
  }
})();

console.log("Database seeded successfully!");
console.log("- Created 500 customers");
console.log("- Created 2000 invoices");

db.close();
