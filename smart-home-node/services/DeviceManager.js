// Singleton registry that notifies active observers after device status changes.
class DeviceManager {
    constructor() {
        if (DeviceManager.instance) {
            return DeviceManager.instance;
        }

        this.observers = [];
        DeviceManager.instance = this;
    }

    addObserver(observer) {
        if (typeof observer.update !== 'function') {
            console.error("failed to add Observer: Object must implement an update() method.");
            return;
        }

        this.observers.push(observer);
    }

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
