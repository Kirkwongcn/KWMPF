import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import app from "../apps/api/src/index.ts";

// Run the production handler over the locally rehearsed snapshot. Comparing its
// complete public response catches missing funds, ties, stale rows and source URLs.
const [exportFile, seedFile, period] = process.argv.slice(2);
const db = new Database(":memory:");
db.exec(readFileSync(exportFile, "utf8"));
if (seedFile !== "-") db.exec(readFileSync(seedFile, "utf8"));
const bindings = {
  DB: {
    prepare(query) {
      const statement = db.prepare(query);
      return {
        first: async () => statement.get(),
        all: async () => ({ results: statement.all() }),
      };
    },
  },
};
const response = await app.request(
  `/rankings?metric=return&period=${period}`,
  {},
  bindings,
);
if (!response.ok) throw new Error(`Local ranking failed (${response.status})`);
console.log(JSON.stringify(await response.json()));
