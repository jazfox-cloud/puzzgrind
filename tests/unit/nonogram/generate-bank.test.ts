import { describe, it } from "vitest";

import { generateNonogramBank } from "../../../scripts/generate-nonogram-bank";

describe("nonogram bank generator", () => {
  it.skipIf(process.env.GENERATE_NONOGRAM !== "1")("writes the original checked bank", () => {
    generateNonogramBank();
  }, 180_000);
});
