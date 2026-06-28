import { MongoClient } from 'mongodb';
import 'dotenv/config';

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);
let db;

// Opens one MongoDB connection and reuses it for the lifetime of the server.
export async function connectDB() {
    if (!db) {
        try {
            await client.connect();
            console.log("Connected to MongoDB");
            db = client.db("SmartHomeDB");
        } catch (error) {
            console.error("Failed to connect to MongoDB", error);
            process.exit(1);
        }
    }

    return db;
}

// Gives controllers access to the established database connection.
export function getDB() {
    if (!db) {
        throw new Error("Database not connected. Call connectDB() first.");
    }

    return db;
}
