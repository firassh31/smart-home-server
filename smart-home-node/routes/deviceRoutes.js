import express from 'express';
import { verifyToken, verifyParent } from '../middleware/authMiddleware.js';
// Explicitly importing every single function so Express CANNOT get confused
import {
    getDeviceTypes,
    getDevices,
    addDevice,
    updateDeviceStatus,
    deleteDevice,
    updateDeviceState,
    editDevice
} from '../controllers/deviceController.js';

const router = express.Router();

// --- THE MAP ---
router.get('/types', getDeviceTypes);
router.get('/', getDevices);
router.put('/:id/state', updateDeviceState);
router.put('/:id/status', updateDeviceStatus);

router.post('/', verifyParent, addDevice);
router.put('/:id', verifyParent, editDevice);
router.delete('/:id', verifyParent, deleteDevice);
export default router;