import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { choice, createJevClient, hashRequest, noul, request, score } from "../src/index.js";

const scenarios = {
  "synthetic-tool-gate": request("Synthetic demo: permit a read-only account status tool call.", {
    safe: noul("Should this read-only tool call be allowed?"),
    route: choice("Which demo outcome applies?", { allow: "Allow the read-only call", block: "Block the call" }),
    urgency: score("Rate the synthetic request urgency.", ["low", "medium", "high"] as const),
  }),
} as const;

const scenarioName = process.argv[2];
if (!scenarioName || !(scenarioName in scenarios)) {
  throw new Error(`Choose one supported scenario: ${Object.keys(scenarios).join(", ")}`);
}
const apiKey = process.env.TYPESAFE_API_KEY;
if (!apiKey) throw new Error("TYPESAFE_API_KEY is required to record a live fixture");

const input = scenarios[scenarioName as keyof typeof scenarios];
const client = createJevClient({ mode: "live", apiKey });
const response = await client.evaluate(input);
const fixture = { schemaVersion: 1, requestHash: hashRequest(input), request: input, response };
const outputPath = join(fileURLToPath(new URL("../fixtures/", import.meta.url)), `${scenarioName}.json`);
await mkdir(new URL("../fixtures/", import.meta.url), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(fixture, null, 2)}\n`, { flag: "wx" });
process.stdout.write(`Wrote sanitized fixture: ${outputPath}\n`);
