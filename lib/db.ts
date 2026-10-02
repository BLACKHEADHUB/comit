import mongoose from "mongoose";

// 연결 객체와 진행 중인 연결 Promise를 함께 캐싱한다.
type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

// 개발 모드에서는 핫리로드로 이 모듈이 계속 다시 실행된다.
// 모듈 변수는 초기화되므로 globalThis에 캐시를 두어 연결이 중복 생성되는 것을 막는다.
const globalForMongoose = globalThis as typeof globalThis & {
  _mongooseCache?: MongooseCache;
};

const cache: MongooseCache = (globalForMongoose._mongooseCache ??= {
  conn: null,
  promise: null,
});

export async function connectDB(): Promise<typeof mongoose> {
  // 이미 연결되어 있으면 그대로 재사용
  if (cache.conn) return cache.conn;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI 환경변수가 설정되지 않았습니다.");
  }

  // 동시에 여러 요청이 와도 연결 시도는 한 번만 하도록 Promise를 공유한다.
  cache.promise ??= mongoose.connect(uri, { bufferCommands: false });

  try {
    cache.conn = await cache.promise;
  } catch (error) {
    // 실패한 Promise가 캐시에 남으면 계속 실패하므로 초기화해 재시도 가능하게 한다.
    cache.promise = null;
    throw error;
  }

  return cache.conn;
}
