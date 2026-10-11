import { expect, test } from "@playwright/test";
import mongoose from "mongoose";
import { comit, createProject, openSubmission, setEditorCode } from "./helpers";

// 이 테스트가 통과해야만 나머지 시나리오가 돈다.
// "앱이 실제 Atlas/Gemini가 아니라 메모리 DB와 빈 AI 키로 돌고 있다"는 것을 눈에 보이는 결과로 확인한다
test("격리 확인: 메모리 DB에 데이터가 생기고 AI는 기본 문구로 대체된다", async ({ page }) => {
  const mongoUri = process.env.E2E_MONGO_URI ?? "";
  expect(mongoUri.startsWith("mongodb://127.0.0.1"), "E2E_MONGO_URI는 메모리 DB여야 해요").toBe(true);

  // 앱과 별개의 연결로 메모리 DB를 직접 들여다본다
  const client = await mongoose.createConnection(mongoUri).asPromise();
  try {
    const db = client;
    const before = await db.collection("projects").countDocuments();

    await createProject(page, "안전확인", "격리 확인용");
    // 앱이 만든 프로젝트가 메모리 DB에 들어왔다 = 앱의 MONGODB_URI가 메모리 DB를 가리킨다
    expect(await db.collection("projects").countDocuments()).toBe(before + 1);
    expect(await db.collection("projects").countDocuments({ title: "격리 확인용" })).toBe(1);

    await setEditorCode(page, "print('hello')\n");
    await comit(page, "격리 확인 제출");
    await openSubmission(page, /내 제안/, "격리 확인 제출");

    // Gemini 키가 비어 있으므로 실제 호출 없이 기본 리포트가 저장된다
    await expect(page.getByText("AI 분석을 불러오지 못했어요.")).toBeVisible();
    const saved = await db.collection("submissions").findOne({ title: "격리 확인 제출" });
    expect(saved?.aiReport?.summary?.[1]).toBe("AI 분석을 불러오지 못했어요.");
  } finally {
    await client.close();
  }
});
