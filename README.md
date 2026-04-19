# 🏠 Smart Home API (Node.js MVC Architecture)

A professional, mobile-first Smart Home API designed for managing and monitoring IoT devices through a unified, app-like interface. The system features a high-performance Node.js (Express) backend and a state-of-the-art Vanilla JavaScript frontend, optimized with modern ES6+ standards for maximum efficiency. This dashboard utilizes a scalable MVC architecture, integrating seamless Room Navigation Pills, intelligent Auto-Iconography, and a secure Device Action Menu. Engineered with a "Native App" mindset, the platform ensures perfect responsiveness and fluid interactions across both desktop browsers and mobile devices.
It heavily leverages the industry-standard "Device Shadow" pattern to maintain a clean, decoupled, and efficient codebase for IoT integration.

## 🏗️ Architecture & Tech Stack
* **Backend:** Node.js, Express.
* **Database:** MongoDB Atlas.
* **Frontend**: HTML5, CSS3 (Modern Design Tokens), JavaScript (ES6+).
* **Design Patterns:** MVC (Model-View-Controller), Device Shadow (Separation of Metadata and Telemetry).
* **Security:** `dotenv` for environment variable management, CORS policies configured for API communication.

## 🚀 Recent Updates & Optimizations
* **Node.js Migration:** Completely refactored the backend from Python/Flask to an asynchronous Node.js/Express environment.
* **Device Shadow Architecture:** Separated device identity (name, room) from telemetry (brightness, temperature) into a nested `state` object.
* **Query Optimization:** Replaced $O(N)$ collection scans with $O(1)$ `ObjectId` lookups for CRUD operations.
* **Database Indexing:** Implemented a B-tree index on the `room` field to drastically speed up sorting and data grouping at the database level.
* **Segmented Room Navigation**: Replaced bulky headers with a sleek, horizontal-scrolling "Pill" menu.
* **Dynamic Tile Layout**: Redesigned device cards into perfect squares with automatic iconography (📺, 💡, ❄️) based on device names.
* **Kebab Menu (Three Dots)**: Improved UI by moving secondary actions (Edit/Delete) into a scoped dropdown menu.
* **Native App Optimization**: Added mobile-first behaviors, including touch-highlight removal and overscroll prevention for an "app-like" feel.
* **Code Refactor**: Optimized both CSS and JS files for performance, using modern ES6+ standards and DRY principles.

## 🛠️ Features
- **Real-time Filtering**: Instantly filter devices by room without page reloads.
- **Interactive Toggles & Sliders**: Modern, animated ON/OFF switches and precise state controls for all smart devices.
- **Smart Factory Defaults**: Automatically provisions exact required telemetry fields (e.g., `brightness: 10`, `temperature: 22`) upon device creation.
- **Global Status Badge**: A sticky header showing the total count of active devices at a glance.
- **Smart Auto-Icons**: Intelligent name-matching logic that assigns relevant emojis to devices automatically.

---

## ⚙️ How to Run the Project

### 1. Prerequisites
* Node.js (v18+ recommended) installed
* A MongoDB Atlas Cluster (Free Tier is sufficient)

### 2. Installation & Setup
Clone the repository and navigate into the project folder:
```bash
git clone [https://github.com/firassh31/Smart_home_api.git](https://github.com/firassh31/Smart_home_api.git)
```

Environment Variables (Important!)
Install the required Node.js dependencies:
``` Bash
npm install

For security, database credentials are not tracked in version control. You must create a .env file in the root directory of the project and add your MongoDB connection string:

MONGO_URI="mongodb+srv://<username>:<password>@<your-cluster-address>/?retryWrites=true&w=majority"
PORT=3000
```
### 3. start the server
```
cd smart-home-node
node server.js
```

## 📡 4. API Endpoints

| HTTP Method | Endpoint | Description |
| :--- | :--- | :--- |
| **GET** | `/devices/` | Fetches a list of all devices, including their nested state data. |
| **POST** | `/devices/` | Creates a new smart device, automatically generating its default `state` folder. |
| **PUT** | `/devices/<id>/status` | Toggles the operational status (on/off) of a specific device. |
| **PUT** | `/devices/<id>/state` | Updates specific telemetry data inside the nested Device Shadow (e.g., `{ "brightness": 75 }`). |
| **DELETE** | `/devices/<id>` | Permanently removes a device using its MongoDB ObjectId. |
