import os
from flask import Flask, render_template
from routes.device_routes import device_bp
from helper import DeviceManager
from patterns import Observer
from dotenv import load_dotenv
load_dotenv()

# Define External Services (Observers) 
class MobileAppService(Observer):
    """
    Simulates a separate mobile microservice. 
    It listens for updates and sends 'push notifications'.
    """
    def update(self, device_id: str, new_status: str):
        print(f"[Mobile Push]: Device {device_id} was turned {new_status.upper()}!")


# Initialize the Web Server 
app = Flask(__name__)

# Register the API Blueprint for all /devices routes
app.register_blueprint(device_bp, url_prefix='/devices')

# Frontend Route
@app.route('/')
def home():
    return render_template('index.html')


#  Application Bootstrap
if __name__ == '__main__':
    #Read the environment variable. If it's completely missing, default to 'False' for safety!
    env_debug = os.getenv('FLASK_DEBUG', 'False')
    
    is_debug_mode = env_debug.lower() in ['true', '1', 't']

    print(f"\n[SYSTEM] Booting MSHome Server...")
    print(f"[SYSTEM] Debug Mode Active: {is_debug_mode}\n")
    # Initialize the Singleton Manager
    manager = DeviceManager()
    
    # Create observers and attach them to the manager
    mobile_service = MobileAppService()
    manager.add_observer(mobile_service)
    print("✅ Observers attached and listening.")
    
    # Start the server
    print("🌐 Server running on http://127.0.0.1:5000")
    app.run(host='0.0.0.0', port=5000, debug=is_debug_mode)