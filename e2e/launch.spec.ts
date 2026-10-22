import { expect, test } from "@playwright/test";
import { collectErrors, comit, createProject, openSubmission, setEditorCode, shot } from "./helpers";

// 런칭 준비 기능: 병합 되돌리기, 댓글·제출 지우기, 쿠키 위조 방지, 약관 화면
test("되돌리기 · 지우기 · 쿠키 서명 · 약관", async ({ browser, page: leader }, testInfo) => {
  const errors = collectErrors(leader);

  // --- 약관/개인정보 처리방침: 첫 화면 바닥글에서 연다 ---
  await leader.goto("/");
  await leader.getByRole("link", { name: "개인정보 처리방침" }).click();
  await expect(leader.getByRole("heading", { level: 1, name: "개인정보 처리방침" })).toBeVisible();
  await shot(leader, testInfo, "L01-privacy");
  await leader.goto("/terms");
  await expect(leader.getByRole("heading", { level: 1, name: "이용약관" })).toBeVisible();

  // --- 병합 → 되돌리기 ---
  await createProject(leader, "팀장하늘", "되돌리기 연습");
  const projectPath = new URL(leader.url()).pathname;
  await setEditorCode(leader, "let score = 10;\n");
  await comit(leader, "점수 변수 추가");
  await openSubmission(leader, /내 제안/, "점수 변수 추가");
  await leader.getByRole("button", { name: "병합하기" }).click();
  await leader.getByRole("dialog").getByRole("button", { name: /병합하기/ }).click();
  await expect(leader.getByText("병합 완료!")).toBeVisible();

  // 방금 병합한 제출에는 [이 병합 되돌리기]가 보인다 (병합된 제출은 지울 수 없으므로 지우기는 없다)
  await leader.reload();
  await expect(leader.getByRole("button", { name: "🗑 제출 지우기" })).toHaveCount(0);
  await leader.getByRole("button", { name: /이 병합 되돌리기/ }).click();
  await shot(leader, testInfo, "L02-revert-confirm");
  await leader.getByRole("group", { name: "확인" }).getByRole("button", { name: "되돌리기" }).click();
  // 되돌리기 기록이 새로 생기고 그 화면으로 이동한다
  await expect(leader.getByRole("heading", { level: 1, name: "되돌리기: 점수 변수 추가" })).toBeVisible();
  await expect(leader.getByText("병합을 되돌렸어요.")).toBeVisible();
  await shot(leader, testInfo, "L03-revert-record");
  const main = await leader.evaluate(async (path) => (await (await fetch(`/api${path}/main`)).json()).mainCode, projectPath);
  expect(main).toBe("");

  // --- 댓글 지우기 → 제출 지우기 ---
  await leader.goto(projectPath);
  await setEditorCode(leader, "let score = 20;\n");
  await comit(leader, "잘못 올린 제출");
  await openSubmission(leader, /내 제안/, "잘못 올린 제출");
  await leader.locator("table").first().waitFor();
  await leader.getByRole("button", { name: "1번 줄에 댓글 달기" }).click();
  await leader.getByRole("button", { name: "❓ 질문" }).click();
  await leader.getByPlaceholder("내용 (선택)").fill("이 숫자는 왜 20이에요?");
  await leader.getByRole("button", { name: "등록하기" }).click();
  await expect(leader.getByText("이 숫자는 왜 20이에요?")).toBeVisible();
  await leader.getByRole("button", { name: /댓글 지우기/ }).click();
  await shot(leader, testInfo, "L04-comment-delete-confirm");
  await leader.getByRole("button", { name: "지우기", exact: true }).click();
  await expect(leader.getByText("이 숫자는 왜 20이에요?")).toBeHidden();

  await leader.getByRole("button", { name: "🗑 제출 지우기" }).click();
  await shot(leader, testInfo, "L05-submission-delete-confirm");
  await leader.getByRole("group", { name: "확인" }).getByRole("button", { name: "지우기" }).click();
  await leader.waitForURL(/\/project\/[0-9a-f]{24}$/);
  await leader.locator(".monaco-editor").first().waitFor();
  const list = await leader.evaluate(async (path) => (await (await fetch(`/api${path}/submissions`)).json()).submissions, projectPath);
  expect(list.map((s: { title: string }) => s.title)).not.toContain("잘못 올린 제출");
  expect(errors, "콘솔 오류").toEqual([]);

  // --- 쿠키 위조 방지: 서명을 떼어낸 쿠키(예전 형식 = 멤버 id만)로는 들어갈 수 없다 ---
  const cookie = (await leader.context().cookies()).find((c) => c.name.startsWith("comit_member_"));
  expect(cookie?.value).toContain(".");
  const forged = await browser.newContext();
  await forged.addCookies([{ ...cookie!, value: cookie!.value.split(".")[0] }]);
  const page = await forged.newPage();
  const res = await page.goto(projectPath);
  expect(res?.status()).toBe(404);
  await forged.close();
});
