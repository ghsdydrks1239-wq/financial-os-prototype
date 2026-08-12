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

const defaultRadarModel = "gpt-5.6-luna";
const defaultCoreModel = "gpt-5.6-terra";
const maxPerFeed = 40;
const maxRadarCandidatesForModel = 120;
const maxRadarItems = 25;
const timeoutMs = 15_000;

const relevantKeywords = [
  "금리", "채권", "국채", "환율", "외환", "원화", "달러", "코스피", "코스닥", "주식", "증권",
  "ETF", "ETN", "선물", "옵션", "파생", "신용", "대출", "유동성", "회사채", "CP", "은행", "금융",
  "한국은행", "연준", "FOMC", "CPI", "물가", "고용", "GDP", "수출", "무역", "반도체", "AI", "엔비디아",
  "실적", "자금조달", "규제", "스프레드", "신용평가", "IPO", "공모", "변동성", "관세", "부동산", "원자재",
  "유가", "M&A", "인수", "합병", "투자", "산업", "경기", "소비", "가계부채", "재정"
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
  pnpm update:read-list       # RSS 수집 → GPT-5.6 Luna RADAR 선별·요약 → GPT-5.6 Terra CORE 5개 선별 → JSON 교체
  pnpm check:read-list-rss    # RSS 수집·중복 제거·RADAR AI 후보만 점검 (API key 불필요)
  node --env-file=.env scripts/update-read-list.mjs --dry-run
                              # RADAR + CORE 결과를 화면에만 출력 (파일 미교체)

Optional model overrides:
  OPENAI_RADAR_MODEL          # 기본값: gpt-5.6-luna
  OPENAI_CORE_MODEL           # 기본값: gpt-5.6-terra
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

function isBroadRadarCandidate(article) {
  // 경제·증권은 넓게 열어두고, 국제는 경제·금융 연결고리가 있는 기사만 1차 통과시킨다.
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
        "User-Agent": "FinancialOSReadListUpdater/2.0 (+RSS reader; contact: local-user)",
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
  const radarCandidates = deduped
    .filter(isBroadRadarCandidate)
    .sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt))
    .slice(0, maxRadarCandidatesForModel);

  if (radarCandidates.length < 5) {
    throw new Error("RSS에서 RADAR 후보를 충분히 찾지 못했습니다.");
  }

  return { rawCount: raw.length, dedupedCount: deduped.length, radarCandidates };
}

function radarSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["items"],
    properties: {
      items: {
        type: "array",
        minItems: 10,
        maxItems: maxRadarItems,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "keywords", "summary"],
          properties: {
            id: { type: "string" },
            keywords: {
              type: "array",
              minItems: 2,
              maxItems: 3,
              items: { type: "string" }
            },
            summary: { type: "string" }
          }
        }
      }
    }
  };
}

function buildRadarPrompt(date, candidates) {
  const compactCandidates = candidates.map((article, index) => ({
    id: `R${String(index + 1).padStart(3, "0")}`,
    source: article.source,
    section: article.section,
    title: article.title,
    publishedAt: article.publishedAt,
    rssSummary: truncate(article.summary, 350)
  }));

  return `오늘은 ${date}입니다.

아래는 매일경제·한국경제의 경제/증권/국제 RSS에서 느슨하게 모은 후보입니다.
금융권 취업 준비자가 아침에 넓게 훑을 가치가 있는 기사만 RADAR로 남기세요.

RADAR의 목적:
- CORE처럼 5개로 좁히는 것이 아니라 오늘 경제·금융 뉴스의 지형을 넓게 보는 것입니다.
- 다만 뉴스 가치가 거의 없는 잡음은 제거합니다.

포함할 만한 기사:
- 거시경제, 물가·고용·경기·소비·무역·재정·통화정책
- 금리·채권·환율·주식·ETF·파생·신용·유동성 등 금융시장
- 은행·증권·운용·보험·금융규제·시장구조
- 기업 실적, 투자, M&A, 자금조달, 산업 변화 중 시장·경제 흐름을 이해하는 데 의미 있는 내용
- 반도체·AI·에너지·부동산·글로벌 이슈 중 경제·시장 연결고리가 있는 내용

제외할 기사:
- 기부·CSR·캠페인·봉사·직원 복지·수상·행사 참석 같은 미담/홍보성 기사
- 단순 인사, 연예·생활·쇼핑성 기사
- 시장·경제 흐름과 연결이 거의 없는 작은 기업 단신
- 사실상 같은 사건을 반복한 중복 기사

선별 강도:
- 직접적인 금융시장 기사만 남기지 말고 경제·산업 흐름을 볼 수 있는 기사도 폭넓게 남기세요.
- 보통 15~25개가 적당하지만 숫자를 채우기 위해 쓸데없는 기사를 넣지 마세요.

각 기사 작성:
- id: 후보의 id를 정확히 사용
- keywords: 핵심 주제 2~3개. '경제', '금융', '증권' 같은 지나치게 일반적인 단어는 가급적 피하세요.
- summary: 한국어 한 문장, 짧고 구체적으로. 제목과 rssSummary에서 확인되는 사실만 사용하세요.
- rssSummary가 비어 있으면 제목에 있는 사실만 보수적으로 풀어 쓰고 새로운 사실을 추측하지 마세요.

후보:
${JSON.stringify(compactCandidates, null, 2)}`;
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

function buildCorePrompt(date, candidates) {
  const compactCandidates = candidates.map((article) => ({
    source: article.source,
    section: article.section,
    title: article.title,
    url: article.url,
    publishedAt: article.publishedAt,
    rssSummary: truncate(article.summary, 500),
    radarKeywords: article.radarKeywords,
    radarSummary: article.radarSummary
  }));

  return `오늘은 ${date}입니다.

아래 후보는 GPT-5.6 Luna가 경제·금융 RADAR로 먼저 선별한 기사들입니다.
이 후보 전체를 비교해서 금융권 취업 준비자가 오늘 직접 읽을 가치가 가장 높은 금융시장 이슈 5개를 고르세요.

선정 기준:
- 금리·채권, 환율, 주식 수급·변동성, 파생상품·ETF, 신용·유동성, 금융규제·시장구조, 주요 거시경제를 우선합니다.
- 기업·산업 뉴스는 시장 가격, 자금조달, 실적, 투자 사이클이나 거시 흐름과 연결될 때 우선합니다.
- 후보 전체를 비교해 상대적으로 중요한 5개만 선택합니다.
- 한 항목은 반드시 하나의 이슈만 다룹니다.
- 같은 사건의 기사만 대표기사 + 관련기사로 묶고, 서로 다른 사건은 합치지 않습니다.
- 사실·숫자는 title과 rssSummary에서 확인되는 정보만 사용합니다. radarSummary는 방향을 잡는 보조 정보일 뿐 새 사실의 근거로 쓰지 마세요.

작성:
- summary: 무슨 기사인지 1~2문장
- reason: 이 기사에서 확인할 시장 연결고리 1~2문장
- lens: 가장 중요한 금융시장 관점
- questions: 원인·시장 영향·다른 자산과의 연결을 생각할 질문 정확히 2개
- mainArticle과 relatedArticles의 source, title, url은 후보의 정확한 값을 사용합니다.
- relatedArticles가 없으면 빈 배열입니다.
- priority는 '매우 높음', '높음', '보통' 중 하나입니다.

중요: 5개를 채우기 위해 서로 다른 이슈를 한 항목에 합치지 마세요.

RADAR 후보:
${JSON.stringify(compactCandidates, null, 2)}`;
}

async function callOpenAI({ model, reasoningEffort, schemaName, schema, system, user }) {
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
      model,
      reasoning_effort: reasoningEffort,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: schemaName,
          strict: true,
          schema
        }
      },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`${model} API 호출 실패: ${response.status} ${details}`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error(`${model} API 응답에서 JSON 콘텐츠를 찾지 못했습니다.`);
  return JSON.parse(content);
}

async function selectRadarWithOpenAI(date, candidates) {
  const model = process.env.OPENAI_RADAR_MODEL || defaultRadarModel;
  const selection = await callOpenAI({
    model,
    reasoningEffort: "low",
    schemaName: "financial_os_radar",
    schema: radarSchema(),
    system: "You are a careful Korean economics and financial-news editor. Preserve breadth, remove low-value noise, never invent facts, and return valid JSON matching the provided schema.",
    user: buildRadarPrompt(date, candidates)
  });
  return { model, selection };
}

async function selectCoreWithOpenAI(date, candidates) {
  const model = process.env.OPENAI_CORE_MODEL || defaultCoreModel;
  const selection = await callOpenAI({
    model,
    reasoningEffort: "medium",
    schemaName: "financial_os_core",
    schema: readListSchema(),
    system: "You are a cautious Korean financial-market editor. Rank stories by relative importance to today's financial markets, not by general newsworthiness. Use only verified candidate metadata and return valid JSON matching the provided schema.",
    user: buildCorePrompt(date, candidates)
  });
  return { model, selection };
}

function validateAndBuildRadar(selection, candidates) {
  if (!Array.isArray(selection?.items) || selection.items.length < 5 || selection.items.length > maxRadarItems) {
    throw new Error("RADAR AI 결과의 항목 수가 올바르지 않습니다. 기존 read-list.json은 변경하지 않았습니다.");
  }

  const candidateById = new Map(
    candidates.map((article, index) => [`R${String(index + 1).padStart(3, "0")}`, article])
  );
  const usedUrls = new Set();

  const radar = selection.items.map((item) => {
    const article = candidateById.get(item.id);
    if (!article) throw new Error(`RADAR 후보에 없는 id가 반환되었습니다: ${item.id}`);
    if (usedUrls.has(article.url)) throw new Error(`RADAR 기사 URL이 중복되었습니다: ${article.url}`);
    usedUrls.add(article.url);

    const keywords = toArray(item.keywords)
      .map((keyword) => String(keyword).trim().replace(/^#/, ""))
      .filter(Boolean)
      .filter((keyword, index, list) => list.indexOf(keyword) === index)
      .slice(0, 3);

    if (keywords.length < 2) {
      throw new Error(`RADAR ${item.id}의 키워드가 2개 미만입니다.`);
    }

    const summary = String(item.summary ?? "").replace(/\s+/g, " ").trim();
    if (!summary) throw new Error(`RADAR ${item.id}의 AI 요약이 비어 있습니다.`);

    return {
      source: article.source,
      section: article.section,
      title: article.title,
      url: article.url,
      publishedAt: article.publishedAt,
      keywords,
      summary: truncate(summary, 180)
    };
  });

  return radar.sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt));
}

function buildCoreCandidates(radar, radarCandidates) {
  const candidateByUrl = new Map(radarCandidates.map((article) => [article.url, article]));
  return radar.map((radarItem) => {
    const original = candidateByUrl.get(radarItem.url);
    if (!original) throw new Error(`RADAR 원본 후보를 찾지 못했습니다: ${radarItem.url}`);
    return {
      ...original,
      radarKeywords: radarItem.keywords,
      radarSummary: radarItem.summary
    };
  });
}

function validateAndBuildReadList(date, radar, selection, candidates) {
  if (!Array.isArray(selection?.items) || selection.items.length !== 5) {
    throw new Error("CORE AI 결과에 정확히 5개 항목이 없습니다. 기존 read-list.json은 변경하지 않았습니다.");
  }

  const candidateByUrl = new Map(candidates.map((article) => [article.url, article]));
  const mainUrls = new Set();
  const items = selection.items.map((item, index) => {
    const main = candidateByUrl.get(canonicalUrl(item.mainArticle?.url ?? ""));
    if (!main) throw new Error(`RADAR 후보에 없는 대표기사 URL이 반환되었습니다: ${item.mainArticle?.url ?? "없음"}`);
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

  const { rawCount, dedupedCount, radarCandidates } = await collectArticles(sourceConfig.feeds);
  console.log(`RSS 수집 완료: 원본 ${rawCount}건 → URL 중복 제거 ${dedupedCount}건 → RADAR AI 후보 ${radarCandidates.length}건`);

  if (isCollectOnly) {
    console.log(JSON.stringify({ radarCandidates: radarCandidates.slice(0, 30) }, null, 2));
    return;
  }

  const date = formatKoreaDate();

  const { model: radarModel, selection: radarSelection } = await selectRadarWithOpenAI(date, radarCandidates);
  const radar = validateAndBuildRadar(radarSelection, radarCandidates);
  console.log(`RADAR 완료: ${radarModel} → ${radar.length}건 선별·키워드·AI 한 줄 요약`);

  const coreCandidates = buildCoreCandidates(radar, radarCandidates);
  const { model: coreModel, selection: coreSelection } = await selectCoreWithOpenAI(date, coreCandidates);
  const readList = validateAndBuildReadList(date, radar, coreSelection, coreCandidates);
  console.log(`CORE 완료: ${coreModel} → 5개 핵심 이슈 선별`);

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
