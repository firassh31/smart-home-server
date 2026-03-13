require('dotenv').config();
import express, { json } from 'express';
import { MongoClient, ObjectId } from 'mongodb'; // הוספנו את ObjectId
import cors from 'cors';

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(json());

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

async function run() {
    try {
        await client.connect();
        console.log("✅ Connected to MongoDB");

        const db = client.db("SmartHomeDB");
        const devicesCollection = db.collection("devices");

        app.get('/devices', async (req, res) => {
            const devices = await devicesCollection.find({}).toArray();
            const formattedDevices = devices.map(device => ({ id: device._id, ...device }));
            res.json(formattedDevices);
        });

        app.post('/devices', async (req, res) => {
            const newDevice = {
                name: req.body.name,
                room: req.body.room || 'Living Room',
                status: 'off'
            };
            const result = await devicesCollection.insertOne(newDevice);
            res.status(201).json({ id: result.insertedId, ...newDevice });
        });

        app.delete('/devices/:id', async (req, res) => {
            const id = req.params.id;
            try {
                const result = await devicesCollection.deleteOne({ _id: new ObjectId(id) });
                if (result.deletedCount === 1) res.json({ message: "Deleted" });
                else res.status(404).json({ error: "Device not found" });
            } catch (e) {
                res.status(500).json({ error: "Invalid ID format" });
            }
        });

        app.put('/devices/:id/status', async (req, res) => {
            const id = req.params.id;
            const newStatus = req.body.status;

            try {
                await devicesCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { status: newStatus } }
                );
                res.json({ message: "Updated", status: newStatus });
            } catch (e) {
                res.status(500).json({ error: "Update failed" });
            }
        });

        app.listen(port, () => {
            console.log(`🚀 Node.js Server running on http://localhost:${port}`);
        });

    } catch (error) {
        console.error("❌ Connection failed", error);
    }
}

run();