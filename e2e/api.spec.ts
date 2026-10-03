import { expect, test, type Page } from "@playwright/test";
import { comit, createProject, openSubmission, setEditorCode } from "./helpers";

// 브라우저 안에서 fetch한다 (앱의 자동 갱신과 같은 방식: 쿠키가 자동으로 실린다)
async function get(page: Page, path: string): Promise<{ status: number; body: unknown }> {
  return page.evaluate(async (url) => {
    const res = await fetch(url, { cache: "no-store" });
    return { status: res.status, body: await res.json().catch(() => null) };
  }, path);
}

// 자동 갱신용 조회 API의 권한 확인: 멤버만 볼 수 있고, 다른 프로젝트의 제출은 볼 수 없다 (멀티테넌시 격리)
test("조회 API는 멤버에게만, 자기 프로젝트 것만 보여준다", async ({ browser, page }) => {
  // 프로젝트 A (이 브라우저가 멤버)
  await createProject(page, "에이", "프로젝트 A");
  const projectA = page.url().split("/project/")[1];
  await setEditorCode(page, "a = 1\n");
  await comit(page, "A의 제출");
  await openSubmission(page, /내 제안/, "A의 제출");
  const submissionA = page.url().split("/submission/")[1];

  // 프로젝트 B (다른 브라우저 = 다른 쿠키)
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await createProject(otherPage, "비", "프로젝트 B");
  const projectB = otherPage.url().split("/project/")[1];

  // 멤버는 자기 프로젝트의 목록과 댓글을 볼 수 있다
  const mine = await get(page, `/api/project/${projectA}/submissions`);
  expect(mine.status).toBe(200);
  expect((mine.body as { submissions: { title: string }[] }).submissions.map((s) => s.title)).toEqual(["A의 제출"]);
  expect((await get(page, `/api/project/${projectA}/submission/${submissionA}/review`)).status).toBe(200);

  // 원본 조회도 멤버에게만
  const main = await get(page, `/api/project/${projectA}/main`);
  expect(main.status).toBe(200);
  expect(main.body).toEqual({ mainCode: "" }); // 아직 병합 전이라 원본은 비어 있다
  expect((await get(otherPage, `/api/project/${projectA}/main`)).status).toBe(404);

  // 다른 프로젝트의 멤버(B)는 A를 볼 수 없다
  expect((await get(otherPage, `/api/project/${projectA}/submissions`)).status).toBe(404);
  expect((await get(otherPage, `/api/project/${projectA}/submission/${submissionA}/review`)).status).toBe(404);
  // 자기 프로젝트 주소에 남의 제출 id를 끼워 넣어도 볼 수 없다 (projectId 필터)
  expect((await get(otherPage, `/api/project/${projectB}/submission/${submissionA}/review`)).status).toBe(404);

  // 쿠키가 없는 방문자, 형식이 틀린 id
  const anonymous = await browser.newContext();
  const anonymousPage = await anonymous.newPage();
  await anonymousPage.goto("/");
  expect((await get(anonymousPage, `/api/project/${projectA}/submissions`)).status).toBe(404);
  expect((await get(page, `/api/project/not-an-id/submissions`)).status).toBe(404);
  expect((await get(page, `/api/project/${projectA}/submission/not-an-id/review`)).status).toBe(404);

  await other.close();
  await anonymous.close();
});
