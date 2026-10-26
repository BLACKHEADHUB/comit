import { expect, test } from "@playwright/test";
import { collectErrors, comit, createProject, expectNoHorizontalScroll, joinProject, openSubmission, setEditorCode, shot } from "./helpers";

// 기여도 리포트: 팀장 병합 + 팀원 제출 + 팀장 리뷰가 표에 그대로 세어지고, 멤버가 아니면 볼 수 없다
test("팀 기여도 리포트", async ({ browser, page: leader }, testInfo) => {
  const errors = collectErrors(leader);
  const inviteUrl = await createProject(leader, "팀장", "기여도 확인");

  // 팀장: 3줄짜리 첫 코드를 올리고 병합
  await setEditorCode(leader, "a\nb\nc\n");
  await comit(leader, "첫 코드");
  await openSubmission(leader, /내 제안/, "첫 코드");
  await leader.getByRole("button", { name: "병합하기" }).click();
  await leader.getByRole("dialog").getByRole("button", { name: /병합하기/ }).click();
  await expect(leader.getByText("병합 완료!")).toBeVisible();

  // 팀원: 합류해서 한 줄 고친 제출을 올린다 (아직 병합 전)
  const memberContext = await browser.newContext();
  const member = await memberContext.newPage();
  await joinProject(member, inviteUrl, "지수");
  await setEditorCode(member, "a\nB\nc\n");
  await comit(member, "b를 대문자로");

  // 팀장: 팀원 제출에 리뷰 댓글 하나
  await leader.goto(leader.url().replace(/\/submission\/.*$/, ""));
  await openSubmission(leader, /리뷰할 것/, "b를 대문자로");
  await leader.getByRole("button", { name: "2번 줄에 댓글 달기" }).click();
  await leader.getByRole("button", { name: /좋아요/ }).click();
  await leader.getByRole("button", { name: "등록하기" }).click();
  await expect(leader.getByRole("button", { name: "등록하기" })).toBeHidden();

  // 헤더의 [📊 기여도]로 리포트를 연다
  await leader.getByRole("link", { name: /프로젝트로 돌아가기/ }).click();
  await leader.getByRole("link", { name: /기여도/ }).click();
  await leader.waitForURL(/\/report$/);
  const rows = leader.locator("tbody tr");
  await expect(rows).toHaveCount(2);
  // 팀장: 반영 1/1, 3줄(100%), 리뷰 1
  await expect(rows.nth(0)).toContainText("팀장");
  await expect(rows.nth(0)).toContainText("1 / 1");
  await expect(rows.nth(0)).toContainText("3줄");
  await expect(rows.nth(0)).toContainText("(100%)");
  await expect(rows.nth(0).locator("td").nth(2)).toHaveText("1");
  // 팀원: 아직 병합 전이라 반영 0/1, 0줄
  await expect(rows.nth(1)).toContainText("지수");
  await expect(rows.nth(1)).toContainText("0 / 1");
  await expect(rows.nth(1)).toContainText("0줄");
  await expect(leader.getByRole("button", { name: /PDF로 저장/ })).toBeVisible();
  await shot(leader, testInfo, "report");
  await expectNoHorizontalScroll(leader);

  // 멤버가 아닌 브라우저는 리포트를 볼 수 없다
  const strangerContext = await browser.newContext();
  const stranger = await strangerContext.newPage();
  const res = await stranger.goto(leader.url());
  expect(res?.status()).toBe(404);

  expect(errors).toEqual([]);
  await memberContext.close();
  await strangerContext.close();
});
