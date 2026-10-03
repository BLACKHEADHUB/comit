import { expect, test } from "@playwright/test";
import { comit, createProject, joinProject, openSubmission, setEditorCode, shot } from "./helpers";

const getEditorCode = (page: import("@playwright/test").Page) =>
  page.evaluate(() => (window as unknown as { monaco: { editor: { getModels: () => { getValue: () => string }[] } } }).monaco.editor.getModels()[0].getValue());

// 원본 변경 알림: 다른 변경이 병합되면 배너가 뜨고, 작성 중인 코드는 절대 바뀌지 않는다
test("원본이 바뀌면 알려주되 작성 중인 코드는 그대로 둔다", async ({ browser, page: leader }, testInfo) => {
  const inviteUrl = await createProject(leader, "팀장", "원본 알림");
  const memberContext = await browser.newContext();
  const member = await memberContext.newPage();
  await joinProject(member, inviteUrl, "팀원");

  // 팀원은 무언가 작성 중
  const draft = "# 팀원이 작성 중인 코드\nprint('draft')\n";
  await setEditorCode(member, draft);
  await expect(member.getByText("원본이 바뀌었어요.")).toBeHidden();

  // 그 사이 팀장이 다른 변경을 올려 병합한다 → 원본이 바뀜
  await setEditorCode(leader, "print('merged by leader')\n");
  await comit(leader, "팀장의 변경");
  await openSubmission(leader, /내 제안/, "팀장의 변경");
  await leader.getByRole("button", { name: "병합하기" }).click();
  await leader.getByRole("dialog").getByRole("button", { name: /병합하기/ }).click();
  await expect(leader.getByText("병합 완료!")).toBeVisible();

  // 팀원 화면: 새로고침 없이(창 포커스 복귀) 배너가 뜬다
  await member.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(member.getByText("원본이 바뀌었어요.")).toBeVisible();
  // 가장 중요한 것: 작성 중인 코드는 한 글자도 바뀌지 않았다
  expect(await getEditorCode(member)).toBe(draft);
  await shot(member, testInfo, "21-original-changed-banner");

  // [최신 원본 보기]: 무엇이 달라졌는지 보여주기만 한다
  await member.getByRole("button", { name: "최신 원본 보기" }).click();
  const dialog = member.getByRole("dialog");
  await expect(dialog).toContainText("내가 보던 원본에서 1줄 바뀜");
  await expect(dialog).toContainText("merged by leader");
  await shot(member, testInfo, "22-latest-original");
  await dialog.getByRole("button", { name: "확인했어요" }).click();
  await expect(dialog).toBeHidden();
  expect(await getEditorCode(member)).toBe(draft);

  await memberContext.close();
});
