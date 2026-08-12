/**
 * Data adapter only. Article content and optional source URLs live in JSON.
 * UI components read this typed interface; personal read state lives in localStorage.
 */
import readListJson from "./read-list.json";
import marketBriefJson from "./market-brief.json";

export type Priority = "매우 높음" | "높음" | "보통";

export type ArticleLink = {
  source: string | null;
  title: string;
  url: string | null;
};

export type RadarItem = {
  source: string;
  section: string;
  title: string;
  url: string;
  publishedAt: string;
  keywords?: string[];
  summary?: string;
};

export type ReadItem = {
  id: string;
  priority: Priority;
  lens: string;
  issue: string;
  summary: string;
  reason: string;
  mainArticle: ArticleLink;
  relatedArticles: ArticleLink[];
  questions: string[];
};

export type MarketVariable = {
  label: string;
  value: string;
  note: string;
};

export type MarketIssue = {
  id: string;
  priority: Priority;
  title: string;
  fact: string;
  view: string;
  variables: string[];
  check: string;
};

export const readListDate = readListJson.date as string;
export const radarItems = ((readListJson as { radar?: RadarItem[] }).radar ?? []) as RadarItem[];
export const coreItems = readListJson.items as ReadItem[];
export const readItems = coreItems;
export const todayMarket = marketBriefJson.todayMarket as string[];
export const marketVariables = marketBriefJson.marketVariables as MarketVariable[];
export const marketIssues = marketBriefJson.marketIssues as MarketIssue[];
