# Smart Home API (Node.js MVC Architecture)

MSHome is a desktop smart-home dashboard backed by a Node.js and Express API. It manages parent and child accounts, protected device inventory, room filtering, device status control, and device-specific state such as brightness, temperature, and lock state.

The project uses a compact MVC-style structure with controllers, routes, middleware, services, and a static HTML/CSS/JavaScript dashboard served by Express.

## Architecture & Tech Stack

* **Backend:** Node.js and Express.
* **Database:** MongoDB Atlas.
* **Frontend:** HTML5, CSS3, and vanilla JavaScript.
* **Design Patterns:** MVC boundaries, role-based access control, and device shadow state.
* **Security:** Environment variables through `dotenv`, JWT authentication, and parent-only device inventory routes.

## Features

* **Authentication:** Parent and child account flows with JWT sessions.
* **Family Access:** Parent accounts receive a family invite code; child accounts can join with that code.
* **Role-Based UI:** Child accounts can only see allowed devices and cannot manage inventory.
* **Room Filtering:** Devices can be filtered by room without reloading the page.
* **Device Controls:** On/off controls, brightness, AC temperature, and door lock state.
* **Weather Widget:** Uses a server-side proxy so the weather API key stays private.

## Project Structure

```text
smart-home-node/
  config/              MongoDB connection
  controllers/         Auth and device request handlers
  middleware/          JWT and role checks
  routes/              Express route definitions
  services/            Device observer registry
  server.js            Express startup and frontend serving
static/
  css/style.css        Dashboard styling
  js/main.js           Dashboard behavior
templates/
  index.html           Dashboard markup
```

## Environment Variables

Create a `.env` file in `smart-home-node/` with:

```bash
MONGO_URI="mongodb+srv://<username>:<password>@<your-cluster-address>/?retryWrites=true&w=majority"
JWT_SECRET="replace-with-a-long-random-secret"
WEATHER_API_KEY="your-openweathermap-key"
PORT=3000
```

## Run The Project

```bash
cd smart-home-node
npm install
npm start
```

Then open:

```text
http://localhost:3000
```

## API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/auth/register` | Creates a parent account or child account. |
| `POST` | `/auth/login` | Authenticates a user and returns a JWT. |
| `GET` | `/devices/types` | Returns supported device types. |
| `GET` | `/devices/` | Fetches devices visible to the current user. |
| `POST` | `/devices/` | Creates a new device. Parent only. |
| `PUT` | `/devices/:id` | Updates device metadata. Parent only. |
| `PUT` | `/devices/:id/status` | Updates device on/off status. |
| `PUT` | `/devices/:id/state` | Updates nested device state fields. |
| `DELETE` | `/devices/:id` | Deletes a device. Parent only. |
