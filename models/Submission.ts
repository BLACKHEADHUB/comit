import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const submissionSchema = new Schema({
  projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
  author: { type: String, required: true, trim: true, maxlength: 20 },
  title: { type: String, required: true, trim: true, maxlength: 80 },
  // beforeCode = 제출 당시의 mainCode (병합 충돌 판단 기준)
  beforeCode: { type: String, default: "" },
  afterCode: { type: String, default: "" },
  aiReport: {
    summary: { type: [String], default: [] }, // 3줄 요약
    warning: { type: String, default: "" }, // 보안·버그 경고
    concept: { type: String, default: "" }, // 핵심 문법 개념 1문장
  },
  status: { type: String, enum: ["PENDING", "MERGED", "STALE"], default: "PENDING" },
  createdAt: { type: Date, default: Date.now },
  // 병합된 시각 (나중에 추가된 선택 필드라 예전 병합에는 없다). "가장 최근 병합"을 찾아 되돌릴 때 쓴다
  mergedAt: { type: Date },
});

// 목록(최신순)과 "가장 최근 병합" 조회용
submissionSchema.index({ projectId: 1, createdAt: -1 });

export type SubmissionDoc = InferSchemaType<typeof submissionSchema>;

export const Submission: Model<SubmissionDoc> =
  (models.Submission as Model<SubmissionDoc>) ??
  model<SubmissionDoc>("Submission", submissionSchema);
