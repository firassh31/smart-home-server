import { getDB } from '../config/db.js';
import { ObjectId } from 'mongodb';
import { deviceManager } from '../services/DeviceManager.js';

// Device type catalog used by the add/edit form.
export const getDeviceTypes = (req, res) => {
    try {
        const types = [
            { value: 'light', label: 'Light' },
            { value: 'ac', label: 'AC' },
            { value: 'doorlock', label: 'Door Lock' }
        ];
        res.status(200).json(types);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch device types" });
    }
};

// Accepts either MongoDB ObjectIds or legacy string ids without throwing.
const getSafeId = (id) => {
    try {
        return ObjectId.isValid(id) ? new ObjectId(id) : id;
    } catch (e) {
        return id;
    }
};

// Fetches all devices visible to the authenticated user's family and role.
export const getDevices = async (req, res) => {
    try {
        const db = getDB();

        const { room } = req.query;

        const filter = { familyId: req.user.familyId || req.user.id };
        if (req.user.role === 'child') {
            filter.childAccess = true;
        }
        if (room && room !== 'All' && room !== '') {
            filter.room = room;
        }

        const devices = await db.collection("devices").find(filter).toArray();

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

// Aggregates device counts based on their 'on' or 'off' status
export const getDeviceStats = async (req, res) => {
    try {
        const db = getDB();

        // 1. Enforce your existing family and role-based security
        const filter = { familyId: req.user.familyId || req.user.id };
        if (req.user.role === 'child') {
            filter.childAccess = true;
        }

        // 2. Execute the Complex Aggregation Pipeline
        const stats = await db.collection('devices').aggregate([
            { $match: filter },          // Stage 1: Only grab devices this user is allowed to see
            {
                $group: {
                    _id: "$status",          // Stage 2: Group them by their status ('on' or 'off')
                    count: { $sum: 1 }       // Stage 3: Count how many fall into each bucket
                }
            }
        ]).toArray();

        res.status(200).json(stats);
    } catch (error) {
        console.error("Error fetching device stats:", error);
        res.status(500).json({ error: "Failed to fetch device stats" });
    }
};

// Updates the on/off status and broadcasts the change to observers.
export const updateDeviceStatus = async (req, res) => {
    try {
        const db = getDB();
        const id = req.params.id;
        const newStatus = req.body.status;

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

        deviceManager.notifyObservers(id, newStatus);
        res.status(200).json({ message: "Updated", status: newStatus });
    } catch (error) {
        console.error("Error updating device:", error);
        res.status(500).json({ error: "Update failed or Invalid ID format" });
    }
};

// Creates a new device with a default state shape for its type.
export const addDevice = async (req, res) => {
    try {
        const db = getDB();
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
            id: Date.now().toString(),
            name,
            room,
            type: deviceType,
            status: 'off',
            state: defaultState,
            childAccess: req.body.childAccess || false,
            familyId: req.user.familyId || req.user.id
        };

        const result = await db.collection("devices").insertOne(newDevice);
        res.status(201).json({ message: "Device added!", id: result.insertedId.toString() });
    } catch (error) {
        console.error("Add device error:", error);
        res.status(500).json({ error: "Failed to add device" });
    }
};

// Removes a device owned by the parent account.
export const deleteDevice = async (req, res) => {
    try {
        const db = getDB();
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

// Updates device metadata controlled by the add/edit form.
export const editDevice = async (req, res) => {
    try {
        const db = getDB();
        const { id } = req.params;
        const { name, room, type, childAccess } = req.body;
        const safeId = getSafeId(id);

        await db.collection('devices').updateOne(
            { _id: safeId },
            { $set: { name, room, type, childAccess } }
        );

        res.status(200).json({ message: "Device updated successfully" });
    } catch (error) {
        console.error("Edit device error:", error);
        res.status(500).json({ error: "Failed to edit device" });
    }
};

// Updates nested device state fields such as brightness or temperature.
export const updateDeviceState = async (req, res) => {
    try {
        const db = getDB();
        const { id } = req.params;
        const stateUpdates = req.body;
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


