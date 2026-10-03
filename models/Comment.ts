import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const commentSchema = new Schema({
  submissionId: { type: Schema.Types.ObjectId, ref: "Submission", required: true, index: true },
  author: { type: String, required: true, trim: true, maxlength: 20 },
  lineNumber: { type: Number, required: true, min: 1 },
  // 태그는 원댓글에만 필수 (답글은 태그 없이 내용만 쓴다)
  tag: {
    type: String,
    enum: ["LIKE", "QUESTION", "BUG"],
    required: function (this: { parentId?: unknown }) {
      return !this.parentId;
    },
  },
  content: { type: String, default: "", trim: true, maxlength: 300 }, // 내용은 선택 (태그만 남겨도 됨),
  // 아래 두 필드는 나중에 추가된 선택 필드다. 예전 댓글에는 값이 없고, 없으면 "원댓글 / 해결 안 됨"으로 본다
  parentId: { type: Schema.Types.ObjectId, ref: "Comment", default: null }, // 답글이면 원댓글의 _id (답글의 답글은 없다)
  resolved: { type: Boolean, default: false }, // 원댓글의 해결 여부
  createdAt: { type: Date, default: Date.now },
});

export type CommentDoc = InferSchemaType<typeof commentSchema>;

export const Comment: Model<CommentDoc> =
  (models.Comment as Model<CommentDoc>) ?? model<CommentDoc>("Comment", commentSchema);
