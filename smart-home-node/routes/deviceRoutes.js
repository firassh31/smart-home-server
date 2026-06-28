import express from 'express';
import { verifyToken, verifyParent } from '../middleware/authMiddleware.js';
import {
    getDeviceTypes,
    getDevices,
    getDeviceStats,
    addDevice,
    updateDeviceStatus,
    deleteDevice,
    updateDeviceState,
    editDevice
} from '../controllers/deviceController.js';

const router = express.Router();

// All device routes require a valid session token.
router.use(verifyToken);

// Child users can read and control allowed devices.
router.get('/types', getDeviceTypes);
router.get('/', getDevices);
router.get('/stats', getDeviceStats);
router.put('/:id/state', updateDeviceState);
router.put('/:id/status', updateDeviceStatus);

// Parent-only routes manage the device inventory.
router.post('/', verifyParent, addDevice);
router.put('/:id', verifyParent, editDevice);
router.delete('/:id', verifyParent, deleteDevice);

export default router;
