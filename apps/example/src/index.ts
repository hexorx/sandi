import { experimentId } from "@sandi/shared";

const name = process.argv[2] ?? "hello sandbox";
console.log(`Sandi example app. Experiment id: ${experimentId(name)}`);
