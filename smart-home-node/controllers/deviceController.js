import { getDB } from '../config/db.js';
import { ObjectId } from 'mongodb';
import { deviceManager } from '../services/DeviceManager.js';

const getSafeId = (id) => {
    try {
        return ObjectId.isValid(id) ? new ObjectId(id) : id;
    } catch (e) {
        return id;
    }
};
// READ (GET): Fetch all devices
export const getDevices = async (req, res) => {
    try {
        const db = await getDB(); // Grab our connected database!
        const devices = await db.collection("devices").find({}).toArray();

        // Format the MongoDB _id to match the frontend requirements
        const formattedDevices = devices.map(device => ({
            ...device,
            id: device._id.toString()
        }));
        res.status(200).json(formattedDevices);
    } catch (error) {
        console.error("Error fetching devices:", error);
        res.status(500).json({ error: "Failed to fetch devices" });
    }
};

// UPDATE (PUT): Change device status
export const updateDeviceStatus = async (req, res) => {
    try {
        const db = await getDB();
        const id = req.params.id;
        const newStatus = req.body.status;

        // Strict Validation (Protecting the DB)
        if (!['on', 'off'].includes(newStatus)) {
            return res.status(400).json({ error: "Invalid status. Must be 'on' or 'off'." });
        }
        const safeId = getSafeId(id);
        const result = await db.collection('devices').updateOne(
            { _id: safeId },
            { $set: { status: newStatus } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: "Device not found" });
        }

        // We tell our Singleton to broadcast this exact change to all Observers!
        deviceManager.notifyObservers(id, newStatus);

        res.status(200).json({ message: "Updated", status: newStatus });

    } catch (error) {
        console.error("Error updating device:", error);
        res.status(500).json({ error: "Update failed or Invalid ID format" });
    }
};

// CREATE (POST): Add a new smart device
export const addDevice = async (req, res) => {
    try {
        const db = await getDB();
        const { name, room, type } = req.body;
        const deviceType = type.toLowerCase();
        let defaultState = {};
        if (deviceType === 'light') {
            defaultState = { brightness: 10 };
        } else if (deviceType === 'ac') {
            defaultState = { temperature: 22 };
        } else if (deviceType === 'doorlock') {
            defaultState = { is_locked: false };
        }
        const newDevice = {
            name: name,
            room: room,
            type: deviceType,
            status: 'off',
            state: defaultState
        };

        const result = await db.collection("devices").insertOne(newDevice);

        res.status(201).json({
            message: "Device added!",
            id: result.insertedId.toString(),
        });
    } catch (error) {
        console.error("❌ ADD ERROR:", error);
        res.status(500).json({ error: "Failed to add device" });
    }
};

// DELETE: Remove a device
export const deleteDevice = async (req, res) => {
    try {
        const db = await getDB();
        const id = req.params.id;
        const safeId = getSafeId(id);
        const result = await db.collection('devices').deleteOne({ _id: safeId });
        if (result.deletedCount === 1) {
            res.status(200).json({ message: "Deleted successfully" });
        } else {
            res.status(404).json({ error: "Device not found" });
        }
    } catch (error) {
        console.error("Error deleting device:", error);
        res.status(500).json({ error: "Invalid ID format or delete failed" });
    }
};
// EDIT DEVICE (PUT): Change device name, room, or type
export const editDevice = async (req, res) => {
    try {
        const db = await getDB();
        const { id } = req.params;

        // Grab the updated text from the Add/Edit Modal
        const { name, room, type } = req.body;

        const safeId = getSafeId(id);
        await db.collection('devices').updateOne(
            { _id: safeId },
            { $set: { name, room, type } }
        );

        res.status(200).json({ message: "Device updated successfully" });
    } catch (error) {
        console.error("❌ EDIT DEVICE ERROR:", error);
        res.status(500).json({ error: "Failed to edit device" });
    }
};

// UPDATE STATE (For Brightness Sliders and AC Temp!)
export const updateDeviceState = async (req, res) => {
    try {
        const db = await getDB();
        const { id } = req.params;
        const stateUpdates = req.body; // Grabs { state.brightness: 50 } or { state.temperature: 22 } or { state.is_locked: true }
        const formattedUpdates = {};
        for (const key in stateUpdates) {
            formattedUpdates[`state.${key}`] = stateUpdates[key];
        }
        const safeId = getSafeId(id);
        const result = await db.collection('devices').updateOne(
            { _id: safeId },
            { $set: formattedUpdates }
        );
        if (result.matchedCount === 0) {
            return res.status(404).json({ error: "Device not found" });
        }
        const updated = await db.collection('devices').findOne({ _id: safeId });
        res.status(200).json({ ...updated, id: updated._id.toString() });
    } catch (error) {
        res.status(500).json({ error: "Failed to update state" });
    }
};