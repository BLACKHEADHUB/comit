import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const commentSchema = new Schema({
  submissionId: { type: Schema.Types.ObjectId, ref: "Submission", required: true, index: true },
  author: { type: String, required: true, trim: true, maxlength: 20 },
  lineNumber: { type: Number, required: true, min: 1 },
  tag: { type: String, enum: ["LIKE", "QUESTION", "BUG"], required: true },
  content: { type: String, default: "", trim: true, maxlength: 300 }, // 내용은 선택 (태그만 남겨도 됨),
  createdAt: { type: Date, default: Date.now },
});

export type CommentDoc = InferSchemaType<typeof commentSchema>;

export const Comment: Model<CommentDoc> =
  (models.Comment as Model<CommentDoc>) ?? model<CommentDoc>("Comment", commentSchema);
