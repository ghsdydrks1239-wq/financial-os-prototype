/**
 * Desk Ledger design reminder: a calm Korean morning-brief workspace with an
 * asymmetric editorial rail, warm paper ground, decisive hierarchy, and no
 * decorative dashboard clutter.
 */
import { useState } from "react";
import {
  BookOpen,
  ChevronRight,
  CircleAlert,
  Clock3,
  ExternalLink,
  FileText,
  ListChecks,
  Newspaper,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { coreItems, radarItems, readListDate, type ArticleLink, type Priority } from "@/data/brief";
import { loadReadArticleIds, saveReadArticleIds } from "@/lib/readState";

const priorityClass: Record<Priority, string> = {
  "매우 높음": "priority-critical",
  높음: "priority-high",
  보통: "priority-normal",
};

function PriorityBadge({ value }: { value: Priority }) {
  return <span className={`priority-badge ${priorityClass[value]}`}>{value}</span>;
}

function ArticleButton({ article }: { article: ArticleLink }) {
  if (!article.url) return null;

  return (
    <Button asChild type="button" variant="outline" className="source-button">
      <a href={article.url} target="_blank" rel="noreferrer" aria-label={`${article.title} 원문 새 탭에서 열기`}>
        원문 보기 <ExternalLink size={14} strokeWidth={1.8} />
      </a>
    </Button>
  );
}

function formatRadarTime(publishedAt: string) {
  const date = new Date(publishedAt);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function RadarView() {
  return (
    <TabsContent value="radar" className="tab-content mt-0 focus-visible:outline-none">
      <section className="banner banner-read">
        <div className="banner-copy">
          <p className="eyebrow"><Newspaper size={13} /> DAILY NEWS RADAR</p>
          <h2>먼저 넓게 보고<br />오늘의 흐름을 잡습니다.</h2>
          <p className="banner-desc">경제·금융 관련 후보에서 잡음을 한 번 걷어내고, 제목·키워드·AI 한 줄 요약으로 빠르게 훑습니다. 관심 가는 기사만 원문으로 확인하세요.</p>
        </div>
        <div className="market-stamp"><span>NEWS</span><strong>RADAR</strong><i>{radarItems.length || "—"} HEADLINES</i></div>
      </section>

      <div className="content-heading">
        <div><p className="section-kicker">RADAR · {String(radarItems.length).padStart(2, "0")} HEADLINES</p><h3>경제·금융 헤드라인 훑기</h3></div>
        <p>키워드와 AI 한 줄 요약은 빠른 맥락 파악을 위한 보조 정보입니다.</p>
      </div>

      {radarItems.length > 0 ? (
        <div className="border-b border-[#d3d0c7]">
          {radarItems.map((item) => {
            const keywords = item.keywords ?? [];
            return (
              <a
                key={item.url}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="group grid grid-cols-[76px_minmax(0,1.05fr)_minmax(260px,.95fr)_20px] items-start gap-5 border-t border-[#d3d0c7] py-4 text-inherit no-underline transition-colors hover:bg-[rgba(255,253,248,.42)] max-lg:grid-cols-[70px_minmax(0,1fr)_20px] max-lg:gap-4 max-sm:grid-cols-[58px_minmax(0,1fr)_18px] max-sm:gap-3 max-sm:py-3"
              >
                <time className="pt-1 text-[10px] font-medium tracking-[-0.02em] text-[#899195] max-sm:text-[9px]">{formatRadarTime(item.publishedAt)}</time>

                <div className="min-w-0">
                  <p className="m-0 mb-1 text-[9px] font-bold tracking-[0.08em] text-[#b54835]">{item.source} · {item.section}</p>
                  <h4 className="m-0 break-keep font-['Noto_Serif_KR'] text-[15px] font-semibold leading-[1.55] tracking-[-0.035em] text-[#263846] transition-colors group-hover:text-[#b54835] max-sm:text-[14px]">{item.title}</h4>
                </div>

                <div className="min-w-0 max-lg:col-start-2 max-lg:col-end-3 max-lg:mt-1">
                  {keywords.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {keywords.map((keyword) => (
                        <span key={keyword} className="rounded-[2px] bg-[#e7e8e3] px-1.5 py-1 text-[9px] font-semibold leading-none text-[#53636b]">#{keyword}</span>
                      ))}
                    </div>
                  )}
                  {item.summary ? (
                    <p className="m-0 line-clamp-2 break-keep text-[11px] leading-[1.7] text-[#66737a] max-sm:text-[10px]">{item.summary}</p>
                  ) : (
                    <p className="m-0 text-[10px] leading-[1.6] text-[#9aa1a3]">요약 정보 없음</p>
                  )}
                </div>

                <ExternalLink size={15} strokeWidth={1.7} className="mt-1 text-[#92999b] transition-colors group-hover:text-[#b54835] max-lg:col-start-3 max-lg:row-start-1" aria-hidden="true" />
              </a>
            );
          })}
        </div>
      ) : (
        <div className="border-y border-[#d3d0c7] py-10 text-center text-[12px] leading-7 text-[#69757b]">
          RADAR 데이터는 다음 뉴스 업데이트부터 표시됩니다.<br />CORE와 자동화는 그대로 유지됩니다.
        </div>
      )}
    </TabsContent>
  );
}

function CoreList() {
  const [completed, setCompleted] = useState<string[]>(() => loadReadArticleIds(readListDate));
  const completedCount = completed.length;

  const toggleRead = (id: string, next: boolean) => {
    setCompleted((current) => {
      const updated = next ? Array.from(new Set(current.concat(id))) : current.filter((item) => item !== id);
      saveReadArticleIds(readListDate, updated);
      return updated;
    });
  };

  return (
    <TabsContent value="core" className="tab-content mt-0 focus-visible:outline-none">
      <section className="banner banner-read">
        <div className="banner-copy">
          <p className="eyebrow"><BookOpen size={13} /> CORE READING DESK</p>
          <h2>오늘 꼭 읽을<br />다섯 개의 핵심 이슈.</h2>
          <p className="banner-desc">RADAR에서 넓게 본 뉴스 중 금융시장 공부 관점에서 직접 읽을 가치가 높은 다섯 개를 깊게 봅니다.</p>
        </div>
        <div className="read-progress" aria-label={`읽기 완료 ${completedCount}개, 전체 5개`}>
          <div className="progress-ring"><span>{completedCount}<small>/5</small></span></div>
          <div><strong>오늘의 CORE</strong><p>{completedCount === 5 ? "모든 핵심 이슈를 확인했습니다." : `${5 - completedCount}개 항목이 남아 있습니다.`}</p></div>
        </div>
      </section>

      <div className="content-heading">
        <div><p className="section-kicker">CORE · 05 ITEMS</p><h3>우선순위별 핵심 읽기</h3></div>
        <p>AI가 금융시장 중요도를 비교해 선정한 오늘의 핵심 5개입니다.</p>
      </div>

      <div className="read-stack">
        {coreItems.map((item, index) => {
          const isDone = completed.includes(item.id);
          const relatedArticlesWithUrl = item.relatedArticles.filter((article) => Boolean(article.url));
          return (
            <article className={`reading-card ${isDone ? "is-read" : ""}`} key={item.id}>
              <div className="card-index" aria-hidden="true">0{index + 1}</div>
              <div className="reading-main">
                <div className="meta-row"><PriorityBadge value={item.priority} /><span className="lens-dot" /> <span>{item.lens}</span></div>
                <h4>{item.issue}</h4>
                <div className="reading-copy-grid">
                  <div><p className="copy-label">무슨 기사인가</p><p>{item.summary}</p></div>
                  <div><p className="copy-label">왜 읽어야 하나</p><p>{item.reason}</p></div>
                </div>
                <div className="must-read"><FileText size={16} strokeWidth={1.8} /><div><span>{item.mainArticle.source ?? "필독 기사"}</span><strong>{item.mainArticle.title}</strong></div><ArticleButton article={item.mainArticle} /></div>
                <div className="article-footer">
                  {relatedArticlesWithUrl.length > 0 && <div className="related-wrap"><span className="footer-label">관련 기사</span>{relatedArticlesWithUrl.map((article) => <a href={article.url ?? undefined} target="_blank" rel="noreferrer" key={`${article.source}-${article.title}`}><ChevronRight size={13} />{article.title}</a>)}</div>}
                  <div className="read-control">
                    <Checkbox id={item.id} checked={isDone} onCheckedChange={(checked) => toggleRead(item.id, checked === true)} />
                    <label htmlFor={item.id}>{isDone ? "읽음 완료" : "읽음으로 표시"}</label>
                  </div>
                </div>
                <aside className="questions-panel"><div className="question-title"><Sparkles size={14} /> 읽으면서 볼 질문</div><ol>{item.questions.map((question) => <li key={question}>{question}</li>)}</ol></aside>
              </div>
            </article>
          );
        })}
      </div>
    </TabsContent>
  );
}

export default function Home() {
  const today = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short" }).format(new Date(`${readListDate}T00:00:00+09:00`));

  return (
    <main className="app-shell">
      <aside className="desk-rail">
        <div className="rail-brand"><div className="brand-mark-wrap"><img src="/manus-storage/financial-os-mark_f1255e5c.png" alt="Financial OS 브랜드 심볼" /><i /></div><div className="brand-label"><b>FINANCIAL OS</b><small>RESEARCH DESK</small></div></div>
        <div className="rail-date"><p>DAILY DESK</p><strong>{today}</strong><span>Financial OS</span></div>
        <div className="rail-note"><Clock3 size={15} /><p><b>넓게 훑고</b><br />핵심을 읽습니다.</p></div>
        <div className="rail-bottom"><span className="status-dot" /> DAILY NEWS MODE</div>
      </aside>

      <div className="workspace">
        <header className="workspace-header">
          <div className="mobile-brand"><div className="brand-mark-wrap"><img src="/manus-storage/financial-os-mark_f1255e5c.png" alt="" /><i /></div><div><strong>FINANCIAL OS</strong><time dateTime={readListDate}>{today}</time></div></div>
          <p><span className="live-dot" /> MORNING EDITION · 07:30 KST</p>
          <div className="header-note"><CircleAlert size={14} /> RADAR · CORE 자동 업데이트</div>
        </header>

        <Tabs defaultValue="radar" className="brief-tabs">
          <div className="tab-nav-wrap">
            <TabsList className="tab-nav">
              <TabsTrigger value="radar"><Newspaper size={16} /> RADAR</TabsTrigger>
              <TabsTrigger value="core"><ListChecks size={16} /> CORE</TabsTrigger>
            </TabsList>
          </div>
          <RadarView />
          <CoreList />
        </Tabs>

        <footer className="workspace-footer"><span>FINANCIAL OS / RESEARCH DESK</span><span>RADAR·CORE는 RSS/API로 매일 자동 업데이트됩니다.</span></footer>
      </div>
    </main>
  );
}