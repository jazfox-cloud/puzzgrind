export interface PageSemantics {
  canonical: string;
  ogUrl: string;
  title: string;
  description: string;
  robots: string;
  mainText: string;
}

export const PAGE_SEMANTIC_FIELDS: ReadonlyArray<keyof PageSemantics>;
export function extractPageSemantics(html: string): PageSemantics;
export function differingPageSemanticFields(left: PageSemantics, right: PageSemantics): Array<keyof PageSemantics>;
