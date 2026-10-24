import { mkdirSync } from "node:fs";
import { join } from "node:path";

for (const dir of ["data", "storage", "backups"]) {
  mkdirSync(join(process.cwd(), dir), { recursive: true });
}
