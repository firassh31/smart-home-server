// Singleton registry that notifies active observers after device status changes.
class DeviceManager {
    constructor() {
        if (DeviceManager.instance) {
            return DeviceManager.instance;
        }

        this.observers = [];
        DeviceManager.instance = this;
    }

    // Registers an observer; it must expose update(deviceId, newStatus).
    // This is the IoT extension point: an MQTT bridge or WebSocket pusher
    // registers here to receive every device status change.
    addObserver(observer) {
        if (typeof observer.update !== 'function') {
            console.error("failed to add Observer: Object must implement an update() method.");
            return;
        }

        this.observers.push(observer);
    }

    // Broadcasts a status change to every observer; one failing observer
    // never prevents the others from being notified.
    notifyObservers(deviceId, newStatus) {
        for (const observer of this.observers) {
            try {
                observer.update(deviceId, newStatus);
            } catch (error) {
                const observerName = observer.constructor.name || 'UnknownObserver';
                console.error(`Observer '${observerName}' failed to process the update for device ${deviceId}:`, error.message);
            }
        }
    }
}

export const deviceManager = new DeviceManager();
