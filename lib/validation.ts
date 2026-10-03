import { z } from "zod";

// 사용자 입력은 항상 길이 제한 + 검증 (코드는 실행하지 않고 텍스트로만 다룬다)
export const nicknameSchema = z
  .string()
  .trim()
  .min(1, "닉네임을 입력해주세요.")
  .max(20, "닉네임은 20자 이하로 입력해주세요.");

export const createProjectSchema = z.object({
  // 이름은 선택 입력 (비우면 기본 이름 사용)
  title: z.string().trim().max(50, "이름은 50자 이하로 입력해주세요."),
  description: z.string().trim().max(200, "설명은 200자 이하로 입력해주세요."),
  nickname: nicknameSchema,
});

export const joinProjectSchema = z.object({
  token: z.string().min(1).max(64),
  nickname: nicknameSchema,
});

// 생성 성공 시에는 이동할 projectId와 초대 링크를 함께 돌려준다
export type FormState = { error?: string; projectId?: string; inviteUrl?: string };

// 제출 입력 검증: 제목/코드 길이 제한 (코드는 실행하지 않고 텍스트로만 저장)
export const createSubmissionSchema = z.object({
  title: z.string().trim().min(1, "제목을 입력해주세요.").max(80, "제목은 80자 이하로 입력해주세요."),
  afterCode: z.string().max(100_000, "코드가 너무 길어요. (최대 10만 자)"),
});

// 사이드바에 보여줄 제출 요약 (코드 본문은 제외해 가볍게 유지)
export type SubmissionItem = {
  id: string;
  title: string;
  author: string;
  status: "PENDING" | "MERGED" | "STALE";
  createdAt: string; // ISO 문자열 (서버→클라이언트 전달용)
  // 카드 배지용 집계 (DB에 저장하는 값이 아니라 목록을 조회할 때 계산한다)
  commentCount: number;
  bugCount: number;
  hasWarning: boolean; // AI 분석에 경고가 있는지
};

export type SubmissionResult = { error?: string; notice?: string; submission?: SubmissionItem };

// 댓글 입력 검증: 태그는 필수, 내용은 선택(길이 제한)
export const createCommentSchema = z.object({
  lineNumber: z.number().int().min(1),
  tag: z.enum(["LIKE", "QUESTION", "BUG"]),
  content: z.string().trim().max(300, "댓글은 300자 이하로 입력해주세요."),
});

export type CommentTag = "LIKE" | "QUESTION" | "BUG";

export type CommentItem = {
  id: string;
  author: string;
  lineNumber: number;
  tag: CommentTag;
  content: string;
  createdAt: string;
};

export type CommentResult = { error?: string; comment?: CommentItem };

export type SubmissionStatus = "PENDING" | "MERGED" | "STALE";

// 병합 결과: error는 권한/입력 오류, status는 병합 시도 후의 최종 상태
export type MergeResult = { error?: string; status?: SubmissionStatus; message?: string };
