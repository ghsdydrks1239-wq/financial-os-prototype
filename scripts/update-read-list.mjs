#!/usr/bin/env node

/**
 * Financial OS CORE / RADAR updater
 *
 * Standalone Node.js script. It uses public RSS feeds and the public OpenAI API
 * only; it does not depend on Manus services, browser state, databases, or jobs.
 */
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { XMLParser } from "fast-xml-parser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const sourceFile = path.join(__dirname, "read-list-rss-sources.json");
const targetFile = path.join(projectRoot, "client", "src", "data", "read-list.json");

const args = new Set(process.argv.slice(2));
const isCollectOnly = args.has("--collect-only");
const isDryRun = args.has("--dry-run");
const isHelp = args.has("--help") || args.has("-h");
const defaultModel = "gpt-4.1-mini";
const maxPerFeed = 40;
const maxCandidatesForModel = 100;
const maxRadarItems = 25;
const timeoutMs = 15_000;

const relevantKeywords = [
  "금리", "채권", "국채", "환율", "외환", "원화", "달러", "코스피", "코스닥", "주식", "증권",
  "ETF", "ETN", "선물", "옵션", "파생", "신용", "대출", "유동성", "회사채", "CP", "은행", "금융",
  "한국은행", "연준", "FOMC", "CPI", "물가", "고용", "GDP", "수출", "무역", "반도체", "AI", "엔비디아",
  "실적", "자금조달", "규제", "스프레드", "신용평가", "IPO", "공모", "변동성"
];

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  cdataPropName: "#cdata",
  trimValues: true,
  parseTagValue: false
});

function printHelp() {
  console.log(`
Financial OS CORE / RADAR updater

Usage:
  pnpm update:read-list       # RSS 수집 → RADAR 생성 → OpenAI CORE 5개 선별 → read-list.json 교체
  pnpm check:read-list-rss    # RSS 수집·중복 제거만 점검 (API key 불필요)
  node --env-file=.env scripts/update-read-list.mjs --dry-run
                              # RADAR + CORE 결과를 화면에만 출력 (파일 미교체)
`);
}

function toArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function asText(value) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join(" ");
  if (typeof value === "object") {
    return asText(value["#cdata"] ?? value["#text"] ?? value._ ?? value.title ?? "");
  }
  return "";
}

function stripHtml(value) {
  return asText(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalUrl(rawUrl) {
  try {
    const url = new URL(rawUrl.trim());
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$|mc_)/i.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

function extractLink(item) {
  const links = toArray(item.link ?? item["atom:link"] ?? item["link"]);
  for (const link of links) {
    if (typeof link === "string") return link;
    if (link && typeof link === "object") {
      const href = link["@_href"] ?? link.href ?? link.url;
      if (href) return asText(href);
      const cdataLink = asText(link);
      if (cdataLink) return cdataLink;
    }
  }
  return asText(item.guid ?? item.id ?? "");
}

function extractItems(parsed) {
  const channel = parsed?.rss?.channel ?? parsed?.channel;
  if (channel?.item) return toArray(channel.item);
  if (parsed?.feed?.entry) return toArray(parsed.feed.entry);
  return [];
}

function extractPublishedAt(item) {
  return asText(item.pubDate ?? item.published ?? item.updated ?? item["dc:date"] ?? "");
}

function formatKoreaDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const read = (type) => parts.find((part) => part.type === type)?.value;
  return `${read("year")}-${read("month")}-${read("day")}`;
}

function truncate(value, length = 700) {
  return value.length > length ? `${value.slice(0, length)}…` : value;
}

function scoreCandidate(article) {
  const searchable = `${article.section} ${article.title} ${article.summary}`.toLowerCase();
  return relevantKeywords.reduce((score, keyword) => score + Number(searchable.includes(keyword.toLowerCase())), 0);
}

function isRadarArticle(article) {
  if (article.section === "경제" || article.section === "증권") return true;
  return scoreCandidate(article) > 0;
}

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "FinancialOSReadListUpdater/1.0 (+RSS reader; contact: local-user)",
        Accept: "application/rss+xml, application/xml, text/xml, application/atom+xml, text/plain, */*"
      }
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function collectArticles(feeds) {
  const results = await Promise.allSettled(
    feeds.map(async (feed) => {
      const xml = await fetchText(feed.url);
      const parsed = parser.parse(xml);
      const items = extractItems(parsed).slice(0, maxPerFeed);
      return items.map((item) => {
        const url = canonicalUrl(extractLink(item));
        return {
          source: feed.source,
          section: feed.section,
          title: stripHtml(item.title),
          url,
          publishedAt: extractPublishedAt(item),
          summary: truncate(stripHtml(item.description ?? item.summary ?? item.content ?? item["content:encoded"] ?? ""))
        };
      });
    })
  );

  const failures = results.filter((result) => result.status === "rejected");
  for (const failure of failures) console.warn(`[RSS 경고] ${failure.reason.message}`);

  const raw = results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
  const byUrl = new Map();
  for (const article of raw) {
    if (!article.url || !article.title) continue;
    if (!byUrl.has(article.url)) byUrl.set(article.url, article);
  }

  const deduped = [...byUrl.values()];

  const radar = deduped
    .filter(isRadarArticle)
    .sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt))
    .slice(0, maxRadarItems)
    .map((article) => ({
      source: article.source,
      section: article.section,
      title: article.title,
      url: article.url,
      publishedAt: article.publishedAt
    }));

  const articles = deduped
    .map((article) => ({ ...article, relevance: scoreCandidate(article) }))
    .filter((article) => article.relevance > 0)
    .sort((left, right) => right.relevance - left.relevance || Date.parse(right.publishedAt) - Date.parse(left.publishedAt));

  if (!articles.length) throw new Error("RSS에서 금융시장 관련 기사 후보를 찾지 못했습니다.");
  return { rawCount: raw.length, radar, articles };
}

function readListSchema() {
  const articleReference = {
    type: "object",
    additionalProperties: false,
    required: ["source", "title", "url"],
    properties: {
      source: { type: "string" },
      title: { type: "string" },
      url: { type: "string" }
    }
  };

  return {
    type: "object",
    additionalProperties: false,
    required: ["items"],
    properties: {
      items: {
        type: "array",
        minItems: 5,
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["priority", "lens", "issue", "summary", "reason", "mainArticle", "relatedArticles", "questions"],
          properties: {
            priority: { type: "string", enum: ["매우 높음", "높음", "보통"] },
            lens: { type: "string" },
            issue: { type: "string" },
            summary: { type: "string" },
            reason: { type: "string" },
            mainArticle: articleReference,
            relatedArticles: { type: "array", items: articleReference },
            questions: { type: "array", minItems: 2, maxItems: 2, items: { type: "string" } }
          }
        }
      }
    }
  };
}

function buildPrompt(date, candidates) {
  return `오늘은 ${date}입니다.

아래 RSS 후보에서 금융권 취업 준비자가 오늘 직접 읽을 가치가 가장 높은 금융시장 이슈 5개를 고르세요.

선정 기준:
- 금리·채권, 환율, 주식 수급·변동성, 파생상품·ETF, 신용·유동성, 금융규제·시장구조, 주요 거시경제를 우선합니다.
- 금융시장 영향이 약한 일반 정치·사회·생활 뉴스는 제외합니다.
- 후보 전체를 비교해 상대적으로 중요한 5개만 선택합니다.
- 한 항목은 반드시 하나의 이슈만 다룹니다.
- 같은 사건의 기사만 대표기사 + 관련기사로 묶고, 서로 다른 사건은 합치지 않습니다.
- 모든 내용은 선택한 mainArticle과 relatedArticles의 title·summary에서 확인되는 정보만 사용합니다.

작성:
- summary: 무슨 기사인지 1~2문장
- reason: 이 기사에서 확인할 시장 연결고리 1~2문장
- lens: 가장 중요한 금융시장 관점
- questions: 원인·시장 영향·다른 자산과의 연결을 생각할 질문 정확히 2개
- mainArticle과 relatedArticles의 source, title, url은 후보의 정확한 값을 사용합니다.
- relatedArticles가 없으면 빈 배열입니다.
- priority는 '매우 높음', '높음', '보통' 중 하나입니다.

중요: 5개를 채우기 위해 서로 다른 이슈를 한 항목에 합치지 마세요.

RSS 후보:
${JSON.stringify(candidates, null, 2)}`;
}

async function selectWithOpenAI(date, candidates) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY 환경변수가 없습니다. 프로젝트 루트에 .env 파일을 만들고 키를 설정하세요.");

  const apiBaseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const response = await fetch(`${apiBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || defaultModel,
      temperature: 0.2,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "financial_os_read_list",
          strict: true,
          schema: readListSchema()
        }
      },
      messages: [
        {
          role: "system",
          content: "You are a cautious Korean financial-market editor. Rank stories by their relative importance to today's financial markets, not by general newsworthiness. Use only verified RSS candidate metadata and return valid JSON matching the provided schema."
        },
        { role: "user", content: buildPrompt(date, candidates) }
      ]
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenAI API 호출 실패: ${response.status} ${details}`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("OpenAI API 응답에서 JSON 콘텐츠를 찾지 못했습니다.");
  return JSON.parse(content);
}

function validateAndBuildReadList(date, radar, selection, candidates) {
  if (!Array.isArray(selection?.items) || selection.items.length !== 5) {
    throw new Error("OpenAI 결과에 정확히 5개 항목이 없습니다. 기존 read-list.json은 변경하지 않았습니다.");
  }

  const candidateByUrl = new Map(candidates.map((article) => [article.url, article]));
  const mainUrls = new Set();
  const items = selection.items.map((item, index) => {
    const main = candidateByUrl.get(canonicalUrl(item.mainArticle?.url ?? ""));
    if (!main) throw new Error(`후보 RSS에 없는 대표기사 URL이 반환되었습니다: ${item.mainArticle?.url ?? "없음"}`);
    if (mainUrls.has(main.url)) throw new Error("대표기사 URL이 중복되었습니다. 기존 read-list.json은 변경하지 않았습니다.");
    mainUrls.add(main.url);

    const relatedArticles = toArray(item.relatedArticles)
      .map((article) => candidateByUrl.get(canonicalUrl(article?.url ?? "")))
      .filter(Boolean)
      .filter((article) => article.url !== main.url)
      .filter((article, relatedIndex, list) => list.findIndex((entry) => entry.url === article.url) === relatedIndex)
      .map((article) => ({ source: article.source, title: article.title, url: article.url }));

    if (!Array.isArray(item.questions) || item.questions.length !== 2) {
      throw new Error(`article-${String(index + 1).padStart(2, "0")}의 질문 수가 2개가 아닙니다.`);
    }

    return {
      id: `article-${String(index + 1).padStart(2, "0")}`,
      priority: item.priority,
      lens: item.lens.trim(),
      issue: item.issue.trim(),
      summary: item.summary.trim(),
      reason: item.reason.trim(),
      mainArticle: { source: main.source, title: main.title, url: main.url },
      relatedArticles,
      questions: item.questions.map((question) => question.trim())
    };
  });

  return { date, radar, items };
}

async function writeAtomically(filePath, data) {
  const temporaryPath = `${filePath}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await rename(temporaryPath, filePath);
}

async function main() {
  if (isHelp) return printHelp();

  const sourceConfig = JSON.parse(await readFile(sourceFile, "utf8"));
  if (!Array.isArray(sourceConfig.feeds) || !sourceConfig.feeds.length) {
    throw new Error("RSS 소스 설정 파일에 feeds가 없습니다.");
  }

  const { rawCount, radar, articles } = await collectArticles(sourceConfig.feeds);
  const candidates = articles.slice(0, maxCandidatesForModel).map(({ relevance, ...article }) => article);
  console.log(`RSS 수집 완료: 원본 ${rawCount}건 → RADAR ${radar.length}건 → 금융시장 관련성 필터 ${articles.length}건 → AI 후보 ${candidates.length}건`);

  if (isCollectOnly) {
    console.log(JSON.stringify({ radar, coreCandidates: candidates.slice(0, 10) }, null, 2));
    return;
  }

  const date = formatKoreaDate();
  const selection = await selectWithOpenAI(date, candidates);
  const readList = validateAndBuildReadList(date, radar, selection, candidates);

  if (isDryRun) {
    console.log(JSON.stringify(readList, null, 2));
    console.log("--dry-run 모드이므로 read-list.json은 변경하지 않았습니다.");
    return;
  }

  await writeAtomically(targetFile, readList);
  console.log(`완료: ${targetFile} 파일을 ${date} RADAR ${radar.length}개 + CORE 5개 항목으로 교체했습니다.`);
}

main().catch((error) => {
  console.error(`실행 실패: ${error.message}`);
  process.exitCode = 1;
});
