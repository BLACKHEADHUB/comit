import { expect, test } from "@playwright/test";
import { collectErrors, comit, createProject, joinProject, openSubmission, setEditorCode, shot } from "./helpers";

// 코드 실행(브라우저 안), Git 기록 내려받기, 접속 중 표시, 리뷰 코칭, 수업 모드를 한 흐름으로 확인한다
test("실행·Git 내보내기·접속 중·리뷰 코칭·수업 모드", async ({ browser, page: leader }, testInfo) => {
  test.setTimeout(180_000);
  const errors = collectErrors(leader);
  const inviteUrl = await createProject(leader, "팀장", "수업 팀 프로젝트");
  const projectUrl = leader.url();

  // --- 코드 실행: JavaScript를 고르면 [▶ 실행]이 생기고, 결과가 아래에 나온다 ---
  await leader.getByLabel("언어").selectOption("javascript");
  await setEditorCode(leader, 'console.log("안녕", 1 + 1);\nconsole.log({ a: 1 });\n');
  await leader.getByRole("button", { name: "▶ 실행" }).click();
  const log = leader.getByRole("log", { name: "실행 결과" });
  await expect(log).toContainText("안녕 2");
  await expect(log).toContainText('"a": 1');
  await shot(leader, testInfo, "run-js");

  // 격리 확인: 실행 코드에서는 우리 화면(document)과 쿠키에 손댈 수 없다
  await setEditorCode(leader, "console.log(document.cookie);\n");
  await leader.getByRole("button", { name: "▶ 실행" }).click();
  await expect(log).toContainText("ReferenceError");

  // 끝나지 않는 반복문은 시간이 지나면 멈춘다 (화면은 계속 움직인다)
  await setEditorCode(leader, "while (true) {}\n");
  await leader.getByRole("button", { name: "▶ 실행" }).click();
  await expect(log).toContainText("초가 지나 멈췄어요", { timeout: 15_000 });

  // 첫 코드를 올리고 병합
  await setEditorCode(leader, "let total = 0;\nconsole.log(total);\n");
  await comit(leader, "첫 코드");
  await openSubmission(leader, /내 제안/, "첫 코드");
  await leader.getByRole("button", { name: "병합하기" }).click();
  await leader.getByRole("dialog").getByRole("button", { name: /병합하기/ }).click();
  await expect(leader.getByText("병합 완료!")).toBeVisible();

  // --- Git 기록 내려받기: zip이 내려온다 ---
  const projectId = projectUrl.split("/").pop()!;
  // (보안 쿠키라서 브라우저 안에서 받아 확인한다)
  const zip = await leader.evaluate(async (url) => {
    const res = await fetch(url);
    const bytes = new Uint8Array(await res.arrayBuffer());
    return { status: res.status, type: res.headers.get("content-type"), head: String.fromCharCode(bytes[0], bytes[1]), text: new TextDecoder().decode(bytes) };
  }, `/api/project/${projectId}/export-git?lang=javascript`);
  expect(zip.status).toBe(200);
  expect(zip.type).toBe("application/zip");
  expect(zip.head).toBe("PK");
  expect(zip.text).toContain("comit-project/main.js");

  // --- 팀원 합류 → 팀장 화면에 "접속 중" ---
  const memberContext = await browser.newContext();
  const member = await memberContext.newPage();
  await joinProject(member, inviteUrl, "지수");
  await setEditorCode(member, "let total = 0;\nconsole.log(total + 1);\n");
  await comit(member, "1 더하기");

  await leader.goto(projectUrl);
  await leader.evaluate(() => window.dispatchEvent(new Event("focus"))); // 자동 갱신을 바로 한 번
  await leader.getByLabel(/멤버 2명 보기/).click();
  await expect(leader.getByText("● 접속 중")).toBeVisible();
  await shot(leader, testInfo, "online");
  await leader.getByLabel(/멤버 2명 보기/).click();

  // --- 리뷰 코칭: 내용이 비어 있으면 팁과 첫마디가 뜨고, 누르면 칸에 들어간다 ---
  await openSubmission(leader, /리뷰할 것/, "1 더하기");
  await leader.getByRole("button", { name: "2번 줄에 댓글 달기" }).click();
  await leader.getByRole("button", { name: /질문/ }).first().click();
  await expect(leader.getByText("💡 무엇이 궁금한지")).toBeVisible();
  await leader.getByRole("button", { name: "왜 이 방법을 골랐는지 궁금해요." }).click();
  await expect(leader.getByPlaceholder("내용 (선택)")).toHaveValue("왜 이 방법을 골랐는지 궁금해요. ");
  await shot(leader, testInfo, "review-coach");
  await leader.getByRole("button", { name: "등록하기" }).click();
  await expect(leader.getByRole("button", { name: "등록하기" })).toBeHidden();

  // --- 수업 모드: 강사가 수업을 만들고, 팀장이 반 코드로 연결하면 강사가 기여도를 본다 ---
  const teacherContext = await browser.newContext();
  const teacher = await teacherContext.newPage();
  await teacher.goto("/");
  await teacher.getByRole("link", { name: /수업 만들기/ }).click();
  await teacher.locator('input[name="title"]').fill("웹프로그래밍 01분반");
  await teacher.locator('input[name="instructorName"]').fill("김교수");
  await teacher.getByRole("button", { name: "수업 만들기" }).click();
  const ownerUrl = (await teacher.getByTestId("owner-url").innerText()).trim();
  const joinCode = (await teacher.locator("code").first().innerText()).trim();
  expect(joinCode).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  await shot(teacher, testInfo, "class-created");
  await teacher.getByRole("link", { name: /수업 화면으로 이동/ }).click();
  await expect(teacher.getByText("아직 연결된 팀이 없어요")).toBeVisible();

  // 팀원(팀장 아님)에게는 연결 칸이 보이지 않는다
  await member.goto(`${projectUrl}/report`);
  await expect(member.getByLabel("반 코드")).toHaveCount(0);

  // 팀장이 기여도 화면에서 반 코드를 넣는다 (소문자·공백도 받아준다)
  await leader.goto(`${projectUrl}/report`);
  await leader.getByLabel("반 코드").fill(` ${joinCode.toLowerCase().replace("-", " ")} `);
  await leader.getByRole("button", { name: "수업에 연결" }).click();
  await expect(leader.getByText(/웹프로그래밍 01분반.*수업에 연결돼 있어요/)).toBeVisible();
  await shot(leader, testInfo, "class-linked");

  // 강사 화면에 팀이 나타나고, 들어가면 기여도 표가 보인다 (코드는 보이지 않는다)
  await teacher.goto(new URL(ownerUrl).pathname);
  const row = teacher.locator("tbody tr").first();
  await expect(row).toContainText("수업 팀 프로젝트");
  await expect(row).toContainText("1 / 2");
  await shot(teacher, testInfo, "class-dashboard");
  await row.getByRole("link", { name: "수업 팀 프로젝트" }).click();
  await expect(teacher.locator("tbody tr")).toHaveCount(2);
  await expect(teacher.getByText("total")).toHaveCount(0);
  await shot(teacher, testInfo, "class-team-report");

  // 잘못된 강사 링크, 연결 안 된 프로젝트는 열리지 않는다
  expect((await teacher.goto("/class/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"))?.status()).toBe(404);
  expect((await teacher.goto(`${new URL(ownerUrl).pathname}/project/000000000000000000000000`))?.status()).toBe(404);

  // 팀장이 연결을 끊으면 강사 화면에서 사라진다
  await leader.getByRole("button", { name: "연결 끊기" }).click();
  await expect(leader.getByRole("button", { name: "수업에 연결" })).toBeVisible();
  await teacher.goto(new URL(ownerUrl).pathname);
  await expect(teacher.getByText("아직 연결된 팀이 없어요")).toBeVisible();

  expect(errors).toEqual([]);
  await memberContext.close();
  await teacherContext.close();
});
