import { MongoClient, type Db } from "mongodb";

const uri = process.env.MONGODB_URI ?? "mongodb://localhost:27017/provenancekit-canvas";

let client: MongoClient;
let db: Db;

declare global {
  // eslint-disable-next-line no-var
  var _canvasMongoClient: MongoClient | undefined;
}

if (process.env.NODE_ENV === "development") {
  if (!global._canvasMongoClient) {
    global._canvasMongoClient = new MongoClient(uri);
  }
  client = global._canvasMongoClient;
} else {
  client = new MongoClient(uri);
}

export async function getDb(): Promise<Db> {
  if (!db) {
    await client.connect();
    db = client.db();
  }
  return db;
}

/** Initialize MongoDB indexes */
export async function initDb(): Promise<void> {
  const database = await getDb();
  const posts = database.collection("posts");
  const users = database.collection("users");
  const follows = database.collection("follows");

  await Promise.all([
    posts.createIndex({ authorId: 1, createdAt: -1 }),
    posts.createIndex({ tags: 1 }),
    posts.createIndex({ originalPostId: 1 }),
    users.createIndex({ username: 1 }, { unique: true }),
    users.createIndex({ privyDid: 1 }, { unique: true }),
    follows.createIndex({ followerId: 1, followingId: 1 }, { unique: true }),
  ]);
}
