# Financial OS READ LIST 갱신 프로그램

이 프로그램은 **매일경제와 한국경제의 공개 RSS**를 수집하고, OpenAI API로 금융시장 학습 가치가 높은 이슈 5개를 고른 뒤 `client/src/data/read-list.json`을 교체합니다. 웹 화면, 브라우저 읽음 상태, MARKET BRIEF는 건드리지 않습니다.

## 사전 준비

Node.js 20 이상과 pnpm이 필요합니다. OpenAI API 키는 `OPENAI_API_KEY` 환경변수로만 전달합니다. `.env` 파일을 사용하는 경우에도 `.env`는 `.gitignore`에 포함되어 있어 Git에 올라가지 않습니다.

```bash
pnpm install
export OPENAI_API_KEY="your_openai_api_key_here"
```

`.env` 파일을 선호한다면 아래 값을 설정한 뒤, `node --env-file=.env scripts/update-read-list.mjs`로 실행할 수 있습니다.

```dotenv
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4.1-mini
```

## 수동 실행

RSS 수집이 먼저 정상인지 확인하려면 다음 명령을 실행합니다. 이 명령은 OpenAI API 키가 없어도 되고 `read-list.json`을 바꾸지 않습니다.

```bash
pnpm check:read-list-rss
```

OpenAI의 선별 결과를 파일 교체 없이 확인하려면 다음 명령을 실행합니다.

```bash
node --env-file=.env scripts/update-read-list.mjs --dry-run
```

실제 갱신은 아래 한 줄입니다.

```bash
pnpm update:read-list
```

프로그램은 RSS 수집, 공통 형식 정리, URL 기준 중복 제거, 금융시장 관련 후보 필터, OpenAI 기반 이슈 5개 선별, RSS 후보 URL 검증, 임시 파일을 통한 안전한 JSON 교체 순서로 작동합니다. OpenAI가 RSS 후보에 없는 URL을 반환하거나 대표기사를 중복 선정하면 기존 JSON을 교체하지 않고 실패합니다.

## 수정 가능한 설정

RSS 주소는 `scripts/read-list-rss-sources.json`에 모여 있습니다. 해당 파일에는 매일경제 경제·증권·국제 RSS와 한국경제 경제·증권·국제 RSS가 들어 있습니다. 기사의 선별 결과는 항상 `client/src/data/read-list.json`에만 기록됩니다.
