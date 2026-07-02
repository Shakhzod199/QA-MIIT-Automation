const GITHUB_API = "https://api.github.com";

export interface GithubConfig {
  token?: string;
  owner?: string;
  repo?: string;
  configured: boolean;
}

/** Reads server-side GitHub config. Never expose these values to the client. */
export function getGithubConfig(): GithubConfig {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;

  return {
    token,
    owner,
    repo,
    configured: Boolean(token && owner && repo),
  };
}

/** Thin fetch wrapper for the GitHub REST API, authenticated with GITHUB_TOKEN. */
export async function githubFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { token } = getGithubConfig();

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(init.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const method = (init.method ?? "GET").toUpperCase();
  // Reads get a revalidation window so a burst of page loads/polling doesn't
  // each re-hit GitHub's API. 30s (> the clients' 15s poll) keeps the server
  // cache warm between polls while staying fresh enough for a CI dashboard
  // where runs take minutes — most client polls now hit warm cache instead of
  // waiting on a GitHub round-trip. Mutations (trigger/cancel) always bypass
  // the cache — never allowed to serve a stale POST response.
  const cacheInit: Pick<RequestInit, "cache" | "next"> =
    method === "GET" ? { next: { revalidate: 30 } } : { cache: "no-store" };

  return fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers,
    ...cacheInit,
  });
}
