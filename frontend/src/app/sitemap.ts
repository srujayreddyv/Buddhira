import type { MetadataRoute } from "next";

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getBaseUrl();

  const routes: { path: string; changeFrequency?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never"; priority?: number }[] = [
    { path: "", changeFrequency: "weekly", priority: 1 },
    { path: "/login", changeFrequency: "monthly", priority: 0.8 },
    { path: "/signup", changeFrequency: "monthly", priority: 0.8 },
    { path: "/forgot-password", changeFrequency: "yearly", priority: 0.3 },
    { path: "/inbox", changeFrequency: "daily", priority: 0.9 },
    { path: "/new", changeFrequency: "monthly", priority: 0.7 },
    { path: "/tags", changeFrequency: "weekly", priority: 0.8 },
  ];

  return routes.map(({ path, changeFrequency, priority }) => ({
    url: path ? `${baseUrl}${path}` : baseUrl,
    lastModified: new Date(),
    changeFrequency,
    priority: priority ?? 0.5,
  }));
}
