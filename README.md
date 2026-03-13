# 🏠 Smart Home API (Microservices Architecture)

A professional, mobile-first Smart Home API designed for managing and monitoring IoT devices through a unified, app-like interface. The system features a high-performance Python (Flask) backend and a state-of-the-art Vanilla JavaScript frontend, optimized with modern ES6+ standards for maximum efficiency. This dashboard utilizes a scalable microservices-ready architecture, integrating seamless Room Navigation Pills, intelligent Auto-Iconography, and a secure Device Action Menu. Engineered with a "Native App" mindset, the platform ensures perfect responsiveness and fluid interactions across both desktop browsers and mobile devices.
It heavily leverages Object-Oriented Programming (OOP) principles and structural design patterns (Singleton, Observer) to maintain a clean, decoupled, and efficient codebase.

## 🏗️ Architecture & Tech Stack
* **Backend:** Python, Flask.
* **Database:** MongoDB Atlas.
* **Frontend**: HTML5, CSS3 (Modern Design Tokens), JavaScript (ES6+).
* **Design Patterns:** Singleton (Database Connection), Observer (Device State Management).
* **Security:** `python-dotenv` for environment variable management, CORS policies configured for microservice communication.

## 🚀 Recent Updates & Optimizations
* **Query Optimization:** Replaced $O(N)$ collection scans with $O(1)$ `ObjectId` lookups for CRUD operations.
* **Database Indexing:** Implemented a B-tree index on the `room` field to drastically speed up sorting and data grouping at the database level.
* **Segmented Room Navigation**: Replaced bulky headers with a sleek, horizontal-scrolling "Pill" menu.
* **Dynamic Tile Layout**: Redesigned device cards into perfect squares with automatic iconography (📺, 💡, ❄️) based on device names.
* **Kebab Menu (Three Dots)**: Improved UI by moving secondary actions (Edit/Delete) into a scoped dropdown menu.
* **Native App Optimization**: Added mobile-first behaviors, including touch-highlight removal and overscroll prevention for an "app-like" feel.
* **Code Refactor**: Optimized both CSS and JS files for performance, using modern ES6+ standards and DRY principles.

## 🛠️ Features
- **Real-time Filtering**: Instantly filter devices by room without page reloads.
- **Interactive Toggles**: Modern, animated ON/OFF switches for all smart devices.
- **Global Status Badge**: A sticky header showing the total count of active devices at a glance.
- **Smart Auto-Icons**: Intelligent name-matching logic that assigns relevant emojis to devices automatically.

---

## ⚙️ How to Run the Project

### 1. Prerequisites
* Python 3.x installed
* A MongoDB Atlas Cluster (Free Tier is sufficient)

### 2. Installation & Setup
Clone the repository and navigate into the project folder:
```bash
git clone <https://github.com/firassh31/Smart_home_api>
cd Smart_home_api
```
### 3. Environment Variables (Important!)
``` bash
# Windows
python -m venv venv
venv\Scripts\activate

# Mac/Linux
python3 -m venv venv
source venv/bin/activate

install the required dependencies:

pip install -r requirements.txt

For security, database credentials are not tracked in version control. You must create a .env file in the root directory of the project and add your MongoDB connection string:

MONGO_URI="mongodb+srv://<username>:<password>@<your-cluster-address>/?retryWrites=true&w=majority"
```
### 4. Start the Server

Run the Flask application:

``` Bash
python main.py
The server will start running on http://127.0.0.1:5000. You can now open your frontend index.html file in a browser to interact with the API!
```

## 📡 API Endpoints

| HTTP Method | Endpoint | Description |
| :--- | :--- | :--- |
| **GET** | `/devices/` | Fetches a list of all devices, sorted automatically by room and name. |
| **POST** | `/devices/` | Creates a new smart device in the database. |
| **PUT** | `/devices/<id>/status` | Toggles the operational status (on/off) of a specific device. |
| **DELETE** | `/devices/<id>` | Permanently removes a device using its MongoDB ObjectId. |


## Future Architecture Map 
This project is currently transitioning into an Event-Driven Architecture.

* **Core API (Python/Flask):** Handles REST endpoints, MongoDB connections, data validation, and security.
* **Real-Time Hub (Node.js):** Located in `smart-home-node/`. Future integration for WebSockets (Socket.io) to push instant UI updates and handle MQTT protocol for physical IoT hardware.
* **Message Broker:** Future integration of Redis to allow Python and Node.js to publish/subscribe to smart home events.
