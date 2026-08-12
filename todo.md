# Financial OS Usability Refinement

- [x] 기존 Desk Ledger 디자인 언어를 유지한 상태에서 현재 화면의 여백·조작 흐름을 점검한다.
- [x] 상단 배너 높이를 줄이고 READ LIST 첫 항목까지의 도달 거리를 단축한다.
- [x] 원문 보기 행동을 데스크톱과 모바일에서 더 분명하고 쉽게 누를 수 있게 조정한다.
- [x] 모바일 헤더, 1열 기사 구조, 터치 영역, 가로 스크롤 방지를 보완한다.
- [x] PC 및 모바일 화면과 탭·읽음 체크 동작을 검증한다.

## Data Separation

- [x] 현재 READ LIST·MARKET BRIEF 데이터와 화면 연결 위치를 확인한다.
- [x] 화면 컴포넌트에서 샘플 데이터를 JSON 파일로 분리한다.
- [x] JSON 데이터를 화면에 연결한 뒤 디자인과 동작이 유지되는지 검증한다.
- [x] 비개발자용 수정 위치 안내를 작성한다.

## Article Links and Local Read State

- [x] READ LIST JSON의 대표·관련 기사 URL 구조와 화면 사용 위치를 점검한다.
- [x] 유효한 URL이 있을 때만 대표·관련 기사 링크를 노출하도록 구현한다.
- [x] 날짜와 기사 ID를 분리 키로 사용하는 localStorage 읽음 상태를 구현한다.
- [x] 새로고침 후 읽음 상태와 진행률 유지 여부를 검증한다.

## Live Career Read List Replacement

- [x] 제공된 5개 Career Read List 항목과 기사 URL을 확인한다.
- [x] `read-list.json`을 오늘 날짜와 article-01~article-05 데이터로 교체한다.
- [x] JSON 렌더링과 원문 링크 조건을 검증한다.

## Live Financial News Read List

- [x] 매일경제·한국경제의 최신 금융시장 기사를 수집하고 원문을 확인한다.
- [x] 중복되지 않는 금융시장 이슈 5개를 대표·관련 기사 구조로 선정한다.
- [x] 오늘 날짜의 READ LIST JSON으로 갱신한다.
- [x] 원문 URL과 화면 렌더링을 검증한다.

## Standalone Read List Updater

- [x] RSS 주소와 독립 실행 프로그램의 입력·출력 구조를 정리한다.
- [x] RSS 수집, 기사 정규화, URL 중복 제거, OpenAI 선별 및 JSON 생성을 구현한다.
- [x] 환경변수 설정과 수동 실행 안내를 작성한다.
- [x] API 키 없이 가능한 점검과 모의 OpenAI 전체 흐름을 검증한다.

## Updater End-to-End Verification

- [x] `.env` Git 제외 규칙과 유효한 API 키 환경변수 제공 여부를 확인한다.
- [x] RSS 수집과 OpenAI 기반 READ LIST 갱신을 실제로 실행한다.
- [x] JSON 형식·5개 항목·RSS URL 출처·웹 렌더링을 검증한다.

## Updater Execution Path Audit

- [ ] API 키 환경변수 존재 여부와 프로젝트 내 참조 위치를 확인한다.
- [ ] mock·fallback·테스트·하드코딩·내장 AI 우회 경로를 확인한다.
- [ ] 실행 로그·네트워크 흔적·생성 JSON의 출처를 판정한다.

## Windows Local Test Package

- [ ] 소스 ZIP에서 제외할 생성물·비밀 파일을 확인한다.
- [ ] Windows 초보자용 로컬 실행 안내를 작성한다.
- [ ] 전체 소스 ZIP을 생성하고 구성 파일을 검증한다.
