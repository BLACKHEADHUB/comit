import { z } from "zod";

// 사용자 입력은 항상 길이 제한 + 검증 (코드는 실행하지 않고 텍스트로만 다룬다)
export const nicknameSchema = z
  .string()
  .trim()
  .min(1, "닉네임을 입력해주세요.")
  .max(20, "닉네임은 20자 이하로 입력해주세요.");

export const createProjectSchema = z.object({
  title: z.string().trim().min(1, "프로젝트 이름을 입력해주세요.").max(50, "이름은 50자 이하로 입력해주세요."),
  description: z.string().trim().max(200, "설명은 200자 이하로 입력해주세요."),
  nickname: nicknameSchema,
});

export const joinProjectSchema = z.object({
  token: z.string().min(1).max(64),
  nickname: nicknameSchema,
});

export type FormState = { error?: string };
