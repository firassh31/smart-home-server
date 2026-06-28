import 'dotenv/config';
import { MongoClient } from 'mongodb';

// Manual smoke test for MongoDB connectivity outside the Express server.
async function testConnection() {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log("Connected to MongoDB via Node.js.");

        // Reads one device document to verify connection and collection access.
        const database = client.db("SmartHomeDB");
        const collection = database.collection("devices");
        const device = await collection.findOne({});

        if (device) {
            console.log("Node.js found a device:");
            console.log(device);
        } else {
            console.log("Connected, but no devices found.");
        }
    } catch (e) {
        console.error("Connection test error:", e);
    } finally {
        await client.close();
    }
}

testConnection();
