# Financial OS 콘텐츠 수정 안내

이 프로젝트의 금융 브리프 문구는 이제 화면 코드와 분리되어 있습니다. 기사 제목, 설명, 질문 등 **콘텐츠만 바꾸려면 JSON 파일만 수정**하면 되며, 화면 디자인 파일을 건드릴 필요가 없습니다.

| 바꾸고 싶은 내용 | 수정할 파일 | 주요 항목 |
|---|---|---|
| READ LIST의 기사 5개와 원문 URL | `client/src/data/read-list.json` | `issue`, `summary`, `reason`, `mainArticle`, `relatedArticles`, `questions` |
| MARKET BRIEF의 3문장·핵심 변수·TOP 5 이슈 | `client/src/data/market-brief.json` | `todayMarket`, `marketVariables`, `marketIssues` |
| 두 JSON 데이터를 화면에 전달하는 연결 규칙 | `client/src/data/brief.ts` | 일반적으로 수정할 필요 없음 |
| 화면에 데이터를 배치하는 구조 | `client/src/pages/Home.tsx` | 일반적으로 수정할 필요 없음 |
| 색상·폰트·여백 등 디자인 | `client/src/index.css` | 콘텐츠 수정 시 건드리지 않음 |

## 가장 쉬운 수정 방법

READ LIST의 첫 번째 기사 제목을 바꾸려면 `read-list.json`의 `items` 안 첫 번째 항목의 `issue` 값을 수정합니다. 필독 기사명과 URL은 `mainArticle.title`, `mainArticle.url`이며, 관련 기사 URL은 `relatedArticles` 안에서 수정합니다. 읽으면서 볼 질문 두 개는 `questions` 안의 두 문장입니다.

대표·관련 기사 URL에는 실제 `https://` 주소를 입력합니다. `url`을 `null`로 두면 화면에는 해당 원문 보기 버튼 또는 관련 기사 링크가 표시되지 않습니다. 읽음 상태는 JSON에 저장하지 않으며, 사용자의 브라우저에 날짜와 기사 ID별로만 저장됩니다.

MARKET BRIEF의 맨 위 3문장을 바꾸려면 `market-brief.json`의 `todayMarket` 안의 세 문장을 수정합니다. TOP 5의 제목과 FACT, MARKET VIEW, CHECK는 같은 파일의 `marketIssues` 항목 안에 있습니다.

> JSON 파일에서는 문장 끝의 쉼표를 마지막 항목 뒤에 붙이지 않고, 큰따옴표(`"`)는 지우지 않아야 합니다. 이 두 가지만 지키면 화면 디자인을 바꾸지 않고도 내용을 업데이트할 수 있습니다.
