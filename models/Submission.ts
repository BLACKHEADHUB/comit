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
});

export type SubmissionDoc = InferSchemaType<typeof submissionSchema>;

export const Submission: Model<SubmissionDoc> =
  (models.Submission as Model<SubmissionDoc>) ??
  model<SubmissionDoc>("Submission", submissionSchema);
