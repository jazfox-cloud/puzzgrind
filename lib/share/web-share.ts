export type ShareCapability = {
  clipboard?: { writeText: (text: string) => Promise<void> };
  share?: (data: { text: string; title: string }) => Promise<void>;
};

export type ShareOutcome = "canceled" | "copied" | "failed" | "shared";

export async function copyText(capability: ShareCapability, text: string): Promise<ShareOutcome> {
  if (!capability.clipboard) return "failed";
  try {
    await capability.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}

export async function shareText(
  capability: ShareCapability,
  input: { text: string; title: string },
): Promise<ShareOutcome> {
  if (!capability.share) return copyText(capability, input.text);
  try {
    await capability.share(input);
    return "shared";
  } catch (error) {
    if (error && typeof error === "object" && "name" in error && error.name === "AbortError") return "canceled";
    return copyText(capability, input.text);
  }
}
