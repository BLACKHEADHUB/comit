import { expect, test } from "@playwright/test";
import { collectErrors, comit, createProject, expectNoHorizontalScroll, joinProject, openSubmission, setEditorCode, shot } from "./helpers";

const BASE_CODE = `function greet(name) {
  return "Hello, " + name;
}

console.log(greet("Comit"));
`;

// 전체 흐름: 프로젝트 생성 → 초대 참여 → 코드 수정 → Comit → 댓글(BUG) → 병합 → 충돌(STALE) → 재제출
test("협업 전체 흐름", async ({ browser, page: leader }, testInfo) => {
  const leaderErrors = collectErrors(leader);
  // --- 랜딩 / 생성 ---
  await leader.goto("/");
  await shot(leader, testInfo, "01-landing");
  await expectNoHorizontalScroll(leader);
  await leader.getByRole("button", { name: "프로젝트 생성" }).click();
  await shot(leader, testInfo, "02-landing-modal");
  await leader.getByRole("link", { name: "시작하기" }).click();
  await leader.waitForURL(/\/project\/create/);
  await shot(leader, testInfo, "03-create");

  const inviteUrl = await createProject(leader, "팀장민수", "첫 팀 프로젝트");
  await leader.locator(".monaco-editor").first().waitFor();
  await shot(leader, testInfo, "04-project-empty");
  await expectNoHorizontalScroll(leader);

  // 팀장이 첫 코드를 올리고 스스로 병합해 원본을 만든다
  await setEditorCode(leader, BASE_CODE);
  await comit(leader, "첫 코드 올리기");
  await openSubmission(leader, /내 제안/, "첫 코드 올리기");
  await leader.getByRole("button", { name: "병합하기" }).click();
  await leader.getByRole("dialog").getByRole("button", { name: /병합하기/ }).click();
  await expect(leader.getByText("병합 완료!")).toBeVisible();

  // --- 두 번째 멤버 참여 (다른 브라우저 = 다른 쿠키) ---
  const memberContext = await browser.newContext();
  const member = await memberContext.newPage();
  const memberErrors = collectErrors(member);
  await member.goto(new URL(inviteUrl).pathname);
  await shot(member, testInfo, "05-invite");
  await joinProject(member, inviteUrl, "팀원지수");
  await member.locator(".monaco-editor").first().waitFor();

  // --- 팀원: 코드 수정 → Comit ---
  await setEditorCode(member, BASE_CODE.replace('"Hello, "', '"안녕, "').replace("console.log", "// 인사 출력\nconsole.log"));
  await expect(member.getByText(/원본에서 \d+줄 바뀜/).first()).toBeVisible();
  await shot(member, testInfo, "06-editor-changed");
  await expectNoHorizontalScroll(member);
  await member.getByRole("button", { name: "Comit하기" }).click();
  await expect(member.getByRole("dialog")).toBeVisible();
  await member.getByRole("dialog").getByLabel("제출 제목").fill("인사말을 한국어로 변경");
  await member.waitForTimeout(500); // 미니 Diff가 그려질 시간
  await shot(member, testInfo, "07-comit-modal");
  await member.getByRole("dialog").getByRole("button", { name: "제출하기" }).click();
  await expect(member.getByRole("dialog")).toBeHidden({ timeout: 30_000 });
  await shot(member, testInfo, "08-project-after-comit");

  // --- 팀장: 같은 원본에서 다른 변경을 올린다 (나중에 충돌이 날 제출) ---
  await leader.goto(leader.url().replace(/\/submission\/.*$/, ""));
  await setEditorCode(leader, BASE_CODE.replace("greet(name)", "greet(name, punctuation)").replace("+ name;", "+ name + punctuation;"));
  await comit(leader, "문장 부호 추가");

  // --- 자동 갱신: 팀원 화면은 새로고침 없이(창에 포커스가 돌아오면) 팀장의 새 제출을 "새 활동" 점과 함께 보여준다 ---
  await member.evaluate(() => window.dispatchEvent(new Event("focus")));
  await member.getByRole("tab", { name: /리뷰할 것/ }).click();
  const fresh = member.getByRole("link", { name: /문장 부호 추가/ });
  await expect(fresh).toBeVisible();
  await expect(fresh).toContainText("새 활동");
  await shot(member, testInfo, "08b-auto-refresh-new-activity");

  // --- 팀장: 팀원의 제출을 리뷰 (BUG 댓글) ---
  await leader.reload();
  await leader.locator(".monaco-editor").first().waitFor();
  await shot(leader, testInfo, "09-project-review-list");
  await openSubmission(leader, /리뷰할 것/, "인사말을 한국어로 변경");
  await leader.locator("table").first().waitFor();
  await shot(leader, testInfo, "10-submission-detail");
  await expectNoHorizontalScroll(leader);

  await leader.getByRole("button", { name: "2번 줄에 댓글 달기" }).click();
  await leader.getByRole("button", { name: /버그/ }).click();
  await leader.getByPlaceholder("내용 (선택)").fill("따옴표 안의 쉼표 뒤 공백이 빠진 것 같아요.");
  await shot(leader, testInfo, "11-comment-form");
  await leader.getByRole("button", { name: "등록하기" }).click();
  // 입력 폼이 닫히고(등록 완료) 댓글 카드로 나타날 때까지 기다린다
  await expect(leader.getByRole("button", { name: "등록하기" })).toBeHidden();
  await expect(leader.getByText("따옴표 안의 쉼표 뒤 공백이 빠진 것 같아요.")).toBeVisible();
  // 댓글을 단 뒤에도 Diff가 그대로 보이고, 그 줄에 말풍선이 붙어야 한다 (댓글을 달면 Diff가 비던 버그의 회귀 방지)
  await expect(leader.locator("table").first()).toContainText("console.log");
  await expect(leader.getByRole("button", { name: /2번 줄 댓글 1개 보기/ })).toBeVisible();
  await shot(leader, testInfo, "12-submission-with-comment");

  // --- 팀장: 병합 확인 창에 "해결 안 된 버그" 경고가 뜬다 → 일단 취소 ---
  await leader.getByRole("button", { name: "병합하기" }).click();
  await expect(leader.getByRole("dialog")).toContainText("해결 안 된 버그 지적이 있어요");
  await shot(leader, testInfo, "13-merge-confirm");
  await leader.getByRole("dialog").getByRole("button", { name: "취소" }).click();

  // --- 팀원(제출 작성자): 답글을 달고 해결 처리 ---
  await member.goto(new URL(leader.url()).pathname);
  await member.getByRole("button", { name: /답글/ }).click();
  await member.getByLabel(/댓글에 답글/).fill("확인했어요! 원래 문장 그대로 둔 거라 괜찮아요.");
  await member.getByRole("button", { name: "답글 등록" }).click();
  await expect(member.getByText("확인했어요! 원래 문장 그대로 둔 거라 괜찮아요.")).toBeVisible();
  await member.getByRole("button", { name: "✓ 해결" }).click();
  await expect(member.getByText("✓ 해결됨")).toBeVisible();
  // 해결되면 줄 옆 말풍선은 숫자 대신 ✓, 상단의 버그 수는 0
  await expect(member.getByRole("button", { name: "2번 줄 해결된 댓글 보기" })).toBeVisible();
  await expect(member.getByText("🐞 버그 0")).toBeVisible();
  await shot(member, testInfo, "13b-reply-resolved");

  // --- 팀장: 새로고침 없이 답글과 해결 상태가 보이고, 병합 확인 창의 경고가 사라진다 ---
  await leader.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(leader.getByText("새 답글")).toBeVisible();
  await expect(leader.getByText("✓ 해결됨")).toBeVisible();
  await leader.getByRole("button", { name: "병합하기" }).click();
  await expect(leader.getByRole("dialog")).not.toContainText("해결 안 된 버그 지적이 있어요");
  await shot(leader, testInfo, "13c-merge-confirm-after-resolve");
  await leader.getByRole("dialog").getByRole("button", { name: "병합하기" }).click();
  await expect(leader.getByText("병합 완료!")).toBeVisible();
  await shot(leader, testInfo, "14-merged");

  // --- 충돌: 이전 원본을 기준으로 올렸던 제출을 병합하려 하면 STALE ---
  await leader.getByRole("link", { name: /프로젝트로 돌아가기/ }).click();
  await leader.waitForURL(/\/project\/[0-9a-f]{24}$/);
  await openSubmission(leader, /내 제안/, "문장 부호 추가");
  await leader.getByRole("button", { name: "병합하기" }).click();
  await leader.getByRole("dialog").getByRole("button", { name: /병합하기/ }).click();
  await expect(leader.getByText("다른 변경이 먼저 병합됐어요")).toBeVisible();
  await shot(leader, testInfo, "15-stale");

  // --- 재제출: 충돌 난 코드를 에디터로 불러와 다시 Comit ---
  await leader.getByRole("button", { name: /에디터로 불러와 다시 Comit하기/ }).click();
  await leader.waitForURL(/\/project\/[0-9a-f]{24}$/);
  await leader.locator(".monaco-editor").first().waitFor();
  await expect(leader.getByText("충돌했던 제출의 코드를 불러왔어요")).toBeVisible();
  await shot(leader, testInfo, "16-stale-loaded");
  await comit(leader, "문장 부호 추가 (다시)");
  await leader.getByRole("tab", { name: /내 제안/ }).click();
  await expect(leader.getByRole("link", { name: /문장 부호 추가 \(다시\)/ })).toBeVisible();
  await shot(leader, testInfo, "17-resubmitted");
  await expectNoHorizontalScroll(leader);

  // --- 팀원 화면: 병합된 뒤의 목록 / 404 ---
  await member.getByRole("link", { name: /프로젝트로 돌아가기/ }).click();
  await member.locator(".monaco-editor").first().waitFor();
  await member.getByRole("tab", { name: /내 제안/ }).click();
  await shot(member, testInfo, "18-member-after-merge");
  // 여기까지 오는 동안 스크립트 오류나 hydration 불일치가 없어야 한다 (아래 404 이동 전까지)
  expect(leaderErrors, "팀장 화면 콘솔 오류").toEqual([]);
  expect(memberErrors, "팀원 화면 콘솔 오류").toEqual([]);

  await member.goto("/project/000000000000000000000000");
  await shot(member, testInfo, "19-not-found");

  await memberContext.close();
});
