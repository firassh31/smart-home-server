from flask import Blueprint, jsonify, request
from helper import DeviceManager  # Import the Manager instead of the DB
from extensions import limiter # Import the limiter from extensions.py

device_bp = Blueprint('device_bp', __name__)
manager = DeviceManager()  # Instantiate the Manager

@device_bp.route('/', methods=['GET'])
def get_devices():
    return jsonify(manager.get_all_devices())

@device_bp.route('/', methods=['POST'])
def add_device():
    data = request.get_json()

    if not data:
        return jsonify({"error: Invalid request: NO JSON payload provided"}),400
    
    name = data.get('name')
    room = data.get('room')
    device_type = data.get('type')

    if not name or not isinstance(name, str) or len(name.strip()) == 0:
        return jsonify({"error": "Invalid or missing 'name'"}), 400
        
    if not room or not isinstance(room, str) or len(room.strip()) == 0:
        return jsonify({"error": "Invalid or missing 'room'"}), 400
    
    allowed_types = ['light', 'ac', 'doorlock']
    if device_type not in allowed_types:
        return jsonify({"error": f"Invalid device type. Must be one of: {allowed_types}"}), 400

    # Clean the strings (remove accidental spaces at the beginning/end)
    clean_name = name.strip()
    clean_room = room.strip()

    # Pass the clean, validated data to the manager
    new_device = manager.add_device(clean_name, clean_room, device_type)
    
    if new_device:
        return jsonify(new_device), 201
    else:
        return jsonify({"error": "Failed to create device in database"}), 500


@device_bp.route('/<device_id>', methods=['DELETE'])
def delete_device(device_id):
    device_id = device_id.strip()
    print(f"DEBUG: Server received clean ID: '{device_id}'")
    
    success = manager.delete_device(device_id)
    if success:
        return jsonify({"message": "Deleted"}), 200
    return jsonify({"error": "Device not found"}), 404
# This route now calls the Manager, which handles the business logic and database interaction. The Manager will also take care of any Observer notifications if needed.
@device_bp.route('/<device_id>', methods=['PUT'])
def update_device_details(device_id):
    data = request.get_json()

    if not data or not isinstance(data, dict):
        return jsonify({"error": "Invalid request: No JSON payload provided"}), 400
    
    name = data.get('name')
    room = data.get('room')
    device_type = data.get('type')

    if not name or not isinstance(name, str) or len(name.strip()) == 0:
        return jsonify({"error": "Invalid or missing 'name'"}), 400
    if not room or not isinstance(room, str) or len(room.strip()) == 0:
        return jsonify({"error": "Invalid or missing 'room'"}), 400
    allowed_types = ['light', 'ac', 'doorlock']
    if device_type not in allowed_types:
        return jsonify({"error": f"Invalid device type. Must be one of: {allowed_types}"}), 400
    clean_name = name.strip()
    clean_room = room.strip()

    success = manager.update_device_details(device_id, clean_name, clean_room, device_type)

    if success:
        return jsonify({"message": "Device updated successfully"}), 200
    else:
        return jsonify({"error": "Device not found or update failed"}), 404

# This new route allows the frontend to update ON/OFF settings of a device without changing its name or room. The Manager will handle the logic of updating the database and notifying any observers about the change.
@device_bp.route('/<device_id>/status', methods=['PUT'])
@limiter.limit("5 per minute")
def update_status(device_id):
    #Professional Standard: Enforce correct HTTP Headers
    if not request.is_json:
        return jsonify({"error": "Unsupported Media Type: Missing 'application/json' header"}), 415
        
    #Safely parse the JSON payload
    try:
        data = request.get_json()
    except Exception as e:
        return jsonify({"error": "Malformed JSON payload"}), 400
        
    #Strict Type Validation
    if not data or not isinstance(data, dict):
        return jsonify({"error": "Invalid request: Payload must be a JSON dictionary"}), 400

    new_status = data.get('status')
    
    #Strict Whitelist Validation
    if new_status not in ['on', 'off']:
        return jsonify({"error": "Invalid status. Must be 'on' or 'off'"}), 400

    #Execute Business Logic
    updated_device = manager.update_device_status(device_id, new_status)
    if updated_device:
        return jsonify(updated_device), 200
        
    return jsonify({"error": "Device not found"}), 404
# This route allows the frontend to update specific settings of a device without changing its name or room. The Manager will handle the logic of updating the database and notifying any observers about the change.
@device_bp.route('/<device_id>/state', methods=['PUT'])
def update_device_state(device_id):
    state_updates = request.get_json()
    
    # Check if the frontend actually sent any data
    if not state_updates or not isinstance(state_updates, dict):
        return jsonify({"error": "Invalid request: No JSON payload provided"}), 400
    
    clean_updates = {} 

    if 'brightness' in state_updates:
        val = state_updates['brightness']
        if not isinstance(val,int) or not (1 <= val <=100):
            return jsonify({"error": "Brightness must be an integer between 1 and 100"}), 400
        clean_updates['brightness'] = val

    if 'temperature' in state_updates:
        val = state_updates['temperature']
        if not isinstance(val,int) or not (16 <= val <=30):
            return jsonify({"error": "temperature must be between 16 and 30"}), 400
        clean_updates['temperature'] = val

    if 'is_locked' in state_updates:
        val = state_updates['is_locked']
        if not isinstance(val,bool):
            return jsonify({"error": "is_locked must be a boolean value"}), 400
        clean_updates['is_locked'] = val
        
    if 'status' in state_updates:
        val = state_updates['status']
        if val not in ['on', 'off']:
            return jsonify({"error": "Status must be 'on' or 'off'"}), 400
        clean_updates['status'] = val

    #If they sent fields we don't recognize, clean_updates will be empty
    if not clean_updates:
        return jsonify({"error": "No valid fields provided for update"}), 400
        
    #Pass only the clean, verified dictionary to the database manager
    updated_device = manager.update_device_state(device_id, clean_updates)
    
    if updated_device:
        return jsonify(updated_device), 200
    return jsonify({"error": "Device not found or update failed"}), 404