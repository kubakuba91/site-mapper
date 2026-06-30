export type CrawledPage = {
  url: string; // full URL
  path: string; // path only, used for display/matching
  title: string | null;
  description: string | null; // meta description
  statusCode: number; // http status when fetched
};

export type CrawlError = { url: string; reason: string };

export type CrawlResult = {
  baseUrl: string;
  pages: CrawledPage[];
  errors: CrawlError[];
};

export type BasicAuth = { username?: string; password?: string };

export type CrawlRequestBody = {
  baseUrl: string;
  auth?: BasicAuth;
};

export type MappingStatus = "unmatched" | "matched" | "dropped";

export type Mapping = {
  oldPath: string;
  newPath: string | null; // null if dropped or unmatched
  status: MappingStatus;
  metadataTitle?: string | null;
  metadataDescription?: string | null;
};
