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

  return fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}
