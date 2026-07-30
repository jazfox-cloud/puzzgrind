export function toYaml(value: unknown, indent?: number): string;
export function render(report: unknown, format: "yaml" | "json"): string;
export function defaultWindow(now?: Date): { start: string; end: string };
