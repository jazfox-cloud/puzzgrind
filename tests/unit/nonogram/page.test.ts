import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import NonogramPage from "@/app/games/nonogram/page";
import { NONOGRAM_COUNTS, nonogramFaqs } from "@/lib/nonogram/copy";

describe("Daily Nonogram page", () => {
  it("keeps the rules, UTC boundary, and bank limit in the server HTML", () => {
    const html = renderToStaticMarkup(createElement(NonogramPage));
    expect(html).toContain("How to play Nonogram");
    expect(html).toContain("00:00 UTC");
    expect(html).toContain(`${NONOGRAM_COUNTS.five} original 5×5 pictures`);
    expect(html).toContain(`${NONOGRAM_COUNTS.ten} original 10×10 pictures`);
    expect(html).toContain("Choosing the UTC puzzle for today");
    for (const item of nonogramFaqs()) expect(html).toContain(item.question);
    expect(html).toContain('"@type":"FAQPage"');
    expect(html).toContain('"@type":"WebApplication"');
    expect(html).not.toContain("noindex");
  });
});
