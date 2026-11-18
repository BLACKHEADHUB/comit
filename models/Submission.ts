
import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const submissionSchema = new Schema({
  projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
  author: { type: String, required: true, trim: true, maxlength: 20 },
  title: { type: String, required: true, trim: true, maxlength: 80 },
  // 제출 당시의 mainCode (병합 충돌 판단 기준)
  beforeCode: { type: String, default: "" },
  afterCode: { type: String, default: "" },
  aiReport: {
    summary: { type: [String], default: [] },
    warning: { type: String, default: "" },
    concept: { type: String, default: "" },
  },
  status: { type: String, enum: ["PENDING", "MERGED", "STALE"], default: "PENDING" },
  createdAt: { type: Date, default: Date.now },
  // 가장 최근 병합을 찾을 때 사용
  mergedAt: { type: Date },
});

// 프로젝트별 제출 목록 최신순 조회
submissionSchema.index({ projectId: 1, createdAt: -1 });

export type SubmissionDoc = InferSchemaType<typeof submissionSchema>;

export const Submission: Model<SubmissionDoc> =
  (models.Submission as Model<SubmissionDoc>) ??
  model<SubmissionDoc>("Submission", submissionSchema);
