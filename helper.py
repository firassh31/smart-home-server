from database import SmartHomeDB
from patterns import Observer
class DeviceManager:
    """
    Singleton Manager class that handles business logic and the Observer Pattern.
    It bridges the Flask API, the MongoDB database, and external observers.
    """
    _instance = None
    _is_initialized = False
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(DeviceManager, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        if not self._is_initialized:
            db_instance = SmartHomeDB()
            
            #Prove to the IDE it is NOT None (This instantly fixes the 4 red errors)
            assert db_instance is not None
            
            #Assign it safely
            self.db = db_instance
            
            self.observers = []
            self.__class__._is_initialized = True

    # --- Observer Pattern Logic ---
    def add_observer(self, observer):
        self.observers.append(observer)

    def notify_observers(self, device_id, new_status):
        for observer in self.observers:
            observer.update(device_id, new_status)

    # --- Business Logic & DB Wrappers ---
    def get_all_devices(self):
        return self.db.get_all_devices()

    def add_device(self, name, room, device_type):
        return self.db.add_device(name, room,device_type)

    def delete_device(self, device_id):
        return self.db.delete_device(device_id)


    def update_device_details(self, device_id, name, room, device_type):
        # Passes the new details directly to the database
        return self.db.update_device_details(device_id, name, room, device_type)
    
    def update_device_status(self, device_id, new_status):
        # Update the database
        updated_device = self.db.update_device_status(device_id, new_status)
        
        # If successful, trigger the Observer Pattern!
        if updated_device:
            self.notify_observers(device_id, new_status)
            return updated_device
        
    def update_device_state(self, device_id, state_updates):
        # Updates specific settings (brightness, temp, etc.) and notifies observers.
        updated_device = self.db.update_device_state(device_id, state_updates)
        
        if updated_device:
            # Format a string for the observer notification
            changes = ", ".join([f"{k}={v}" for k, v in state_updates.items()])
            self.notify_observers(device_id, f"updated settings: {changes}")
            return updated_device