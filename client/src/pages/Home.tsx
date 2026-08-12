/**
 * Desk Ledger design reminder: a calm Korean morning-brief workspace with an
 * asymmetric editorial rail, warm paper ground, decisive hierarchy, and no
 * decorative dashboard clutter.
 */
import { useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  ExternalLink,
  FileText,
  Layers3,
  ListChecks,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { marketIssues, marketVariables, readItems, readListDate, todayMarket, type ArticleLink, type Priority } from "@/data/brief";
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

function ReadList() {
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
    <TabsContent value="read" className="tab-content mt-0 focus-visible:outline-none">
      <section className="banner banner-read">
        <div className="banner-copy">
          <p className="eyebrow"><BookOpen size={13} /> DAILY READING DESK</p>
          <h2>오늘의 판단을 바꿀<br />다섯 개의 읽을거리.</h2>
          <p className="banner-desc">기사의 양보다 시장을 해석하는 순서에 집중합니다. 각 항목의 관찰 질문을 함께 확인하세요.</p>
        </div>
        <div className="read-progress" aria-label={`읽기 완료 ${completedCount}개, 전체 5개`}>
          <div className="progress-ring"><span>{completedCount}<small>/5</small></span></div>
          <div><strong>오늘의 읽기</strong><p>{completedCount === 5 ? "모든 핵심 이슈를 확인했습니다." : `${5 - completedCount}개 항목이 남아 있습니다.`}</p></div>
        </div>
      </section>

      <div className="content-heading">
        <div><p className="section-kicker">READ LIST · 05 ITEMS</p><h3>우선순위별 읽기 흐름</h3></div>
        <p>모든 내용은 사용 흐름 검증을 위한 샘플입니다.</p>
      </div>

      <div className="read-stack">
        {readItems.map((item, index) => {
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

function MarketBrief() {
  return (
    <TabsContent value="market" className="tab-content mt-0 focus-visible:outline-none">
      <section className="banner banner-market">
        <div className="banner-copy">
          <p className="eyebrow"><Layers3 size={13} /> MARKET MORNING NOTE</p>
          <h2>움직임보다<br />구조를 읽습니다.</h2>
          <p className="banner-desc">금리·환율·AI 투자 사이클의 연결고리가 오늘의 위험 선호를 가늠하는 핵심입니다.</p>
        </div>
        <div className="market-stamp"><span>MARKET</span><strong>BRIEF</strong><i>샘플 · 2026.08.12</i></div>
      </section>

      <section className="today-market" aria-labelledby="today-market-title">
        <div className="section-title-block"><p className="section-kicker">OPENING VIEW</p><h3 id="today-market-title">Today’s Market</h3></div>
        <div className="market-sentences">{todayMarket.map((sentence, index) => <p key={sentence}><b>0{index + 1}</b> {sentence}</p>)}</div>
      </section>

      <section className="variables-section" aria-labelledby="variables-title">
        <div className="section-title-block"><p className="section-kicker">SIGNAL BOARD</p><h3 id="variables-title">핵심 시장 변수 3개</h3></div>
        <div className="variable-list">
          {marketVariables.map((variable, index) => <div className="variable-item" key={variable.label}><span className="variable-no">0{index + 1}</span><div><span>{variable.label}</span><strong>{variable.value}</strong><p>{variable.note}</p></div></div>)}
        </div>
      </section>

      <div className="content-heading brief-heading"><div><p className="section-kicker">TOP 5 MARKET ISSUES</p><h3>오늘의 이슈 체크리스트</h3></div><p>사실과 해석, 확인할 변수를 분리해 기록합니다.</p></div>
      <div className="issues-list">
        {marketIssues.map((issue, index) => (
          <article className="market-issue" key={issue.id}>
            <div className="issue-left"><span>0{index + 1}</span><PriorityBadge value={issue.priority} /></div>
            <div className="issue-body"><h4>{issue.title}</h4><div className="issue-grid"><div><p className="issue-label">FACT</p><p>{issue.fact}</p></div><div><p className="issue-label">MARKET VIEW</p><p>{issue.view}</p></div></div><div className="issue-bottom"><div><p className="issue-label">MARKET VARIABLES</p><div className="variable-tags">{issue.variables.map((variable) => <span key={variable}>{variable}</span>)}</div></div><div className="check-block"><p className="issue-label"><CheckCircle2 size={13} /> CHECK</p><p>{issue.check}</p></div></div></div>
          </article>
        ))}
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
        <div className="rail-date"><p>DAILY DESK</p><strong>{today}</strong><span>샘플 프로토타입</span></div>
        <div className="rail-note"><Clock3 size={15} /><p><b>매일의 흐름을</b><br />읽을거리와<br />시장 변수로 정리합니다.</p></div>
        <div className="rail-bottom"><span className="status-dot" /> LOCAL SAMPLE MODE</div>
      </aside>

      <div className="workspace">
        <header className="workspace-header">
          <div className="mobile-brand"><div className="brand-mark-wrap"><img src="/manus-storage/financial-os-mark_f1255e5c.png" alt="" /><i /></div><div><strong>FINANCIAL OS</strong><time dateTime={readListDate}>{today}</time></div></div>
          <p><span className="live-dot" /> MORNING EDITION · 07:00 KST</p>
          <div className="header-note"><CircleAlert size={14} /> 표본 자료 기반 · 자동 데이터 연결 미사용</div>
        </header>
        <Tabs defaultValue="read" className="brief-tabs">
          <div className="tab-nav-wrap"><TabsList className="tab-nav"><TabsTrigger value="read"><ListChecks size={16} /> READ LIST</TabsTrigger><TabsTrigger value="market"><ArrowUpRight size={16} /> MARKET BRIEF</TabsTrigger></TabsList></div>
          <ReadList />
          <MarketBrief />
        </Tabs>
        <footer className="workspace-footer"><span>FINANCIAL OS / MODEL CONTENT</span><span>이 프로토타입은 외부 RSS, API, 데이터베이스를 사용하지 않습니다.</span></footer>
      </div>
    </main>
  );
}
