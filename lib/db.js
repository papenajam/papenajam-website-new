import { MongoClient } from 'mongodb';

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'pa_penajam';

let client;
let db;

export async function connectDB() {
  if (db) return db;
  if (!client) {
    client = new MongoClient(MONGO_URL);
    await client.connect();
  }
  db = client.db(DB_NAME);
  return db;
}

export async function getCollection(name) {
  const database = await connectDB();
  return database.collection(name);
}
