export interface HtmlCacheHeaders {
  cacheControl?: string;
  cdnCacheControl?: string;
  cloudflareCdnCacheControl?: string;
}

export interface CacheSafetyResult {
  safe: boolean;
  reason: string;
}

export function evaluateHtmlCacheSafety(headers: HtmlCacheHeaders): CacheSafetyResult;
