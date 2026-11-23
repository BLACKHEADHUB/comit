import mongoose from "mongoose";
import { expect, test, type Page } from "@playwright/test";
import { createProject, setEditorCode } from "./helpers";

async function openSubmissionDialog(page: Page, title: string, code: string) {
  await setEditorCode(page, code);
  await page.getByRole("button", { name: "Comit하기" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("제출 제목").fill(title);
  return dialog;
}

async function closeOpenDialog(page: Page) {
  const dialog = page.getByRole("dialog");
  if (await dialog.isVisible()) {
    await dialog.getByRole("button", { name: "취소" }).click();
    await expect(dialog).toBeHidden();
  }
}

test("동시 제출에서도 중복과 프로젝트 제출 상한을 지킨다", async ({ browser, page }) => {
  test.setTimeout(180_000);
  const mongoUri = process.env.E2E_MONGO_URI;
  if (!mongoUri) throw new Error("격리된 E2E MongoDB 주소가 있어야 합니다.");

  const db = await mongoose.createConnection(mongoUri, { directConnection: true, family: 4 }).asPromise();
  const submissions = db.collection("submissions");

  try {
    await createProject(page, "팀장", "동시 제출 검증");
    const projectUrl = page.url();
    const projectId = projectUrl.split("/").pop()!;
    const projectObjectId = new mongoose.Types.ObjectId(projectId);
    const secondContext = await browser.newContext({ storageState: await page.context().storageState() });
    const secondPage = await secondContext.newPage();
    await secondPage.goto(projectUrl);

    try {
      // 같은 브라우저 사용자가 같은 원본·코드를 거의 동시에 보내도 한 건만 저장되어야 한다.
      const duplicateCode = "console.log('같은 변경');\n";
      const duplicateDialogs = await Promise.all([
        openSubmissionDialog(page, "중복 A", duplicateCode),
        openSubmissionDialog(secondPage, "중복 B", duplicateCode),
      ]);
      await Promise.all(duplicateDialogs.map((dialog) =>
        dialog.getByRole("button", { name: "제출하기" }).click()
      ));

      await expect.poll(async () => {
        const visibleDialogs = await Promise.all([page, secondPage].map((p) =>
          p.getByRole("dialog").isVisible()
        ));
        return visibleDialogs.filter((visible) => !visible).length;
      }).toBe(1);
      await expect.poll(() => submissions.countDocuments({ projectId: projectObjectId })).toBe(1);
      await expect.poll(async () => {
        const alerts = await Promise.all([page, secondPage].map((p) =>
          p.getByRole("alert").allTextContents()
        ));
        return alerts.flat().filter((message) =>
          message.includes("같은 내용의 제출이 이미 있어요.")
        ).length;
      }).toBe(1);

      await closeOpenDialog(page);
      await closeOpenDialog(secondPage);

      // 기존 제출을 198건 채워 총 199건으로 만든 뒤, 서로 다른 제출 두 개를 동시에 보낸다.
      await submissions.insertMany(Array.from({ length: 198 }, (_, i) => ({
        projectId: projectObjectId,
        author: `seed-${i}`,
        title: `기존 제출 ${i}`,
        beforeCode: "seed-base",
        afterCode: `seed-code-${i}`,
        status: "STALE",
        createdAt: new Date(Date.now() - i * 1_000),
      })));
      await expect(submissions.countDocuments({ projectId: projectObjectId })).resolves.toBe(199);

      const limitDialogs = await Promise.all([
        openSubmissionDialog(page, "상한 경쟁 A", "console.log('경쟁 A');\n"),
        openSubmissionDialog(secondPage, "상한 경쟁 B", "console.log('경쟁 B');\n"),
      ]);
      // 서버 액션이 성공하면 모달이 닫히고, 한도 초과면 모달이 오류와 함께 열린다.
      // 클릭은 성공 여부 판정이 아니므로 모달 갱신과 경합해도 테스트를 중단하지 않는다.
      await Promise.allSettled(limitDialogs.map((dialog) =>
        dialog.getByRole("button", { name: "제출하기" }).click()
      ));

      // DB 상태가 동시성 제어의 기준이다. 알림 DOM은 서버 액션 완료 후 별도 렌더링되므로
      // 이를 같은 polling 조건에 묶으면 CI에서 성공한 저장도 실패로 오판할 수 있다.
      await expect.poll(() => submissions.countDocuments({ projectId: projectObjectId }), {
        message: "동시 제출 경쟁 후에도 프로젝트 제출 수가 정확히 200이어야 합니다.",
        timeout: 30_000,
      }).toBe(200);

      const project = await db.collection("projects").findOne({ _id: projectObjectId });
      expect(project?.submissionRevision).toBeGreaterThanOrEqual(2);
    } finally {
      await secondContext.close();
    }
  } finally {
    await db.close();
  }
});
