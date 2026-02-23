import Parser from "rss-parser";
import { createLogger } from "../lib/logger";

const log = createLogger("NewsRSS");

export interface RawNewsItem {
  title: string;
  url: string;
  description: string;
  pubDate: Date | null;
  sourceName: string;
  language: "fr" | "en";
  imageUrl?: string;
}

const RSS_FEEDS = [
  {
    url: "https://news.google.com/rss/search?q=solaire+%C3%A9nergie+Qu%C3%A9bec+OR+Hydro-Qu%C3%A9bec+OR+panneaux+solaires&hl=fr-CA&gl=CA&ceid=CA:fr",
    language: "fr" as const,
    defaultSource: "Google News FR",
  },
  {
    url: "https://news.google.com/rss/search?q=solar+energy+Quebec+OR+Hydro-Quebec+OR+battery+storage&hl=en-CA&gl=CA&ceid=CA:en",
    language: "en" as const,
    defaultSource: "Google News EN",
  },
];

export async function fetchNewsFromRss(): Promise<RawNewsItem[]> {
  const parser = new Parser({
    timeout: 15000,
    headers: {
      "User-Agent": "kWh-Quebec-News-Aggregator/1.0",
    },
  });

  const allItems: RawNewsItem[] = [];
  const seenUrls = new Set<string>();

  for (const feed of RSS_FEEDS) {
    try {
      log.info(`Fetching RSS feed: ${feed.url.substring(0, 80)}...`);
      const parsed = await parser.parseURL(feed.url);
      log.info(`Got ${parsed.items?.length || 0} items from ${feed.defaultSource}`);

      for (const item of parsed.items || []) {
        const url = item.link || item.guid || "";
        if (!url || seenUrls.has(url)) continue;
        seenUrls.add(url);

        const sourceName = (item as any).source?.name ||
          (item as any).source?.$?.url ||
          (item as any)["source"] ||
          feed.defaultSource;

        let imageUrl: string | undefined;
        const content = (item as any)["content:encoded"] || item.content || "";
        const imgMatch = content.match(/<img[^>]+src="([^"]+)"/);
        if (imgMatch) {
          imageUrl = imgMatch[1];
        }
        const mediaContent = (item as any)["media:content"];
        if (!imageUrl && mediaContent?.$?.url) {
          imageUrl = mediaContent.$.url;
        }

        allItems.push({
          title: (item.title || "").trim(),
          url,
          description: (item.contentSnippet || item.content || "").replace(/<[^>]+>/g, "").trim().substring(0, 1000),
          pubDate: item.pubDate ? new Date(item.pubDate) : null,
          sourceName: typeof sourceName === "string" ? sourceName : feed.defaultSource,
          language: feed.language,
          imageUrl,
        });
      }
    } catch (error) {
      log.error(`Failed to fetch RSS feed ${feed.defaultSource}:`, error);
    }
  }

  log.info(`Total unique articles fetched: ${allItems.length}`);
  return allItems;
}
