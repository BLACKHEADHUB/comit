import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
// 수업 모델도 프로젝트와 함께 등록한다: 컬렉션·인덱스가 앱이 처음 DB를 쓸 때 같이 만들어지게 하려고 (실행 도중 처음 만들면 늦게 만들어진다)
import "./Classroom";

// 멤버는 서브문서라 _id가 자동 생성된다. 이 _id를 쿠키에 저장해 "나"를 식별한다.
const memberSchema = new Schema(
  {
    nickname: { type: String, required: true, trim: true, maxlength: 20 },
    role: { type: String, enum: ["LEADER", "MEMBER"], required: true },
    // 복구 코드의 해시 (원문은 저장하지 않는다). 예전 멤버는 없을 수 있다
    recoveryHash: { type: String },
    // 마지막으로 프로젝트 화면을 보고 있던 시각 ("접속 중" 표시용). 1분에 한 번만 갱신한다
    lastSeenAt: { type: Date },
  },
  { _id: true }
);

const projectSchema = new Schema({
  title: { type: String, required: true, trim: true, maxlength: 50 },
  description: { type: String, default: "", trim: true, maxlength: 200 },
  members: { type: [memberSchema], default: [] },
  mainCode: { type: String, default: "" },
  // 제출 생성 요청을 프로젝트별로 직렬화해 중복 제출·개수 제한 경쟁 상태를 막는다.
  submissionRevision: { type: Number, default: 0 },
  // 초대 링크용 추측 불가능한 토큰 (조회가 잦으므로 unique 인덱스)
  inviteToken: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
  lastActivityAt: { type: Date, default: Date.now }, // 마지막 활동(제출·병합·댓글). 오래 안 쓰면 정리 대상이 된다
  // 연결된 수업(반). 팀장이 반 코드를 넣으면 생기고, 강사는 이 반에 연결된 프로젝트의 기여도만 볼 수 있다
  classroomId: { type: Schema.Types.ObjectId, ref: "Classroom", default: null },
});

// 복구 코드로 멤버를 찾는 조회용 (값이 없는 멤버는 인덱스에서 뺀다)
projectSchema.index({ lastActivityAt: 1 }); // 정리 대상 조회용
projectSchema.index({ classroomId: 1 }, { partialFilterExpression: { classroomId: { $type: "objectId" } } }); // 강사 화면에서 반에 연결된 프로젝트 조회용
projectSchema.index({ "members.recoveryHash": 1 }, { sparse: true });

export type ProjectDoc = InferSchemaType<typeof projectSchema>;

// 핫리로드 시 모델이 중복 등록되는 것을 방지
export const Project: Model<ProjectDoc> =
  (models.Project as Model<ProjectDoc>) ?? model<ProjectDoc>("Project", projectSchema);
