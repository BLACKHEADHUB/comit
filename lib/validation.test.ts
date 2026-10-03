import { describe, expect, it } from "vitest";
import {
  createCommentSchema,
  createProjectSchema,
  createReplySchema,
  createSubmissionSchema,
  joinProjectSchema,
  nicknameSchema,
} from "@/lib/validation";

describe("nicknameSchema", () => {
  it("앞뒤 공백을 잘라낸다", () => {
    expect(nicknameSchema.parse("  민수  ")).toBe("민수");
  });

  it("빈 값과 공백만 있는 값은 거부한다", () => {
    expect(nicknameSchema.safeParse("").success).toBe(false);
    expect(nicknameSchema.safeParse("   ").success).toBe(false);
  });

  it("20자까지만 허용한다", () => {
    expect(nicknameSchema.safeParse("가".repeat(20)).success).toBe(true);
    expect(nicknameSchema.safeParse("가".repeat(21)).success).toBe(false);
  });
});

describe("createProjectSchema", () => {
  it("이름은 비워도 된다 (기본 이름 사용)", () => {
    const parsed = createProjectSchema.safeParse({ title: "", description: "", nickname: "팀장" });
    expect(parsed.success).toBe(true);
  });

  it("이름 50자, 설명 200자를 넘으면 거부한다", () => {
    expect(createProjectSchema.safeParse({ title: "a".repeat(51), description: "", nickname: "팀장" }).success).toBe(false);
    expect(createProjectSchema.safeParse({ title: "", description: "a".repeat(201), nickname: "팀장" }).success).toBe(false);
  });
});

describe("joinProjectSchema", () => {
  it("토큰이 비었거나 너무 길면 거부한다", () => {
    expect(joinProjectSchema.safeParse({ token: "", nickname: "민수" }).success).toBe(false);
    expect(joinProjectSchema.safeParse({ token: "t".repeat(65), nickname: "민수" }).success).toBe(false);
    expect(joinProjectSchema.safeParse({ token: "abc", nickname: "민수" }).success).toBe(true);
  });
});

describe("createSubmissionSchema", () => {
  it("제목은 필수이고 80자 이하", () => {
    expect(createSubmissionSchema.safeParse({ title: "  ", afterCode: "x" }).success).toBe(false);
    expect(createSubmissionSchema.safeParse({ title: "a".repeat(81), afterCode: "x" }).success).toBe(false);
    expect(createSubmissionSchema.parse({ title: " 버튼 추가 ", afterCode: "x" }).title).toBe("버튼 추가");
  });

  it("코드는 잘라내지 않고 그대로 두며 10만 자까지 허용한다", () => {
    expect(createSubmissionSchema.parse({ title: "t", afterCode: "  x\n" }).afterCode).toBe("  x\n");
    expect(createSubmissionSchema.safeParse({ title: "t", afterCode: "a".repeat(100_000) }).success).toBe(true);
    expect(createSubmissionSchema.safeParse({ title: "t", afterCode: "a".repeat(100_001) }).success).toBe(false);
  });
});

describe("createCommentSchema", () => {
  it("태그만 있어도 된다 (내용은 선택)", () => {
    expect(createCommentSchema.safeParse({ lineNumber: 1, tag: "LIKE", content: "" }).success).toBe(true);
  });

  it("정해진 태그만 허용한다", () => {
    expect(createCommentSchema.safeParse({ lineNumber: 1, tag: "HATE", content: "" }).success).toBe(false);
  });

  it("줄 번호는 1 이상의 정수여야 한다", () => {
    expect(createCommentSchema.safeParse({ lineNumber: 0, tag: "BUG", content: "" }).success).toBe(false);
    expect(createCommentSchema.safeParse({ lineNumber: 1.5, tag: "BUG", content: "" }).success).toBe(false);
  });

  it("내용은 300자 이하", () => {
    expect(createCommentSchema.safeParse({ lineNumber: 1, tag: "BUG", content: "a".repeat(301) }).success).toBe(false);
  });
});

describe("createReplySchema", () => {
  it("답글은 내용이 필수 (태그가 없으므로)", () => {
    expect(createReplySchema.safeParse({ content: "  " }).success).toBe(false);
    expect(createReplySchema.parse({ content: " 고마워요 " }).content).toBe("고마워요");
  });

  it("300자 이하", () => {
    expect(createReplySchema.safeParse({ content: "a".repeat(301) }).success).toBe(false);
  });
});
