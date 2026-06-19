export const BASE_URL = process.env.PMI_BASE_URL ?? "https://testpmi.miit.uz/auth";

function requireCredential(name: "PMI_USERNAME" | "PMI_PASSWORD"): string {
  const value = process.env[name];
  if (!value || value === "example") {
    throw new Error(
      `${name} is not set. Provide real OneID credentials via the ${name} env var before running the PMI login test.`
    );
  }
  return value;
}

export const USERNAME = requireCredential("PMI_USERNAME");
export const PASSWORD = requireCredential("PMI_PASSWORD");
