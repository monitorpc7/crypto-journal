# Crypto Trading Journal

This is a full-stack web application that serves as a trading journal for cryptocurrencies. It allows users to track their trades, analyze their performance, and view live market data.

## Features

*   **Trade Logging:** Record details for each trade, including entry/exit prices, long/short type, invested amount, strategy, and notes.
*   **Performance Analytics:** Automatically calculates and displays key metrics like Profit & Loss (P&L), win rate, ROI, and total trades.
*   **Image Uploads:** Optionally attach a chart image to each trade for visual reference.
*   **Live Price Dashboard:** View real-time cryptocurrency prices from the MEXC exchange.
*   **Filtering and Sorting:** Easily search, filter, and sort your trade history.
*   **Dark/Light Mode:** Switch between themes for comfortable viewing.

## Tech Stack

*   **Backend:** Python, FastAPI, Uvicorn
*   **Database:** MongoDB (with Motor for async access)
*   **Frontend:** React (with Create React App and Craco), JavaScript, Tailwind CSS
*   **Libraries:**
    *   Backend: Pydantic, Pandas, Numpy
    *   Frontend: Axios, Radix UI, Lucide React, React Hook Form

## Prerequisites

Before you begin, ensure you have the following installed:

*   [Node.js](https://nodejs.org/) (v14 or later)
*   [Yarn](https://yarnpkg.com/)
*   [Python](https://www.python.org/) (v3.8 or later)
*   [Pip](https://pip.pypa.io/en/stable/installation/)
*   [MongoDB](https://www.mongodb.com/try/download/community)

## Local Development Setup

To run this application on your local machine, follow these steps:

### 1. Clone the Repository

```bash
git clone <repository-url>
cd <repository-directory>
```

### 2. Backend Setup

```bash
# Navigate to the backend directory
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Set up environment variables
# Create a .env file in the backend/ directory and add the following:
# MONGO_URL="mongodb://localhost:27017"
# DB_NAME="trading_journal"
# CORS_ORIGINS="http://localhost:3000"

# Start the backend server
uvicorn server:app --reload
```
The backend will be running at `http://localhost:8000`.

### 3. Frontend Setup

```bash
# Navigate to the frontend directory (from the root)
cd frontend

# Install Node.js dependencies
yarn install

# Set up environment variables
# Create a .env file in the frontend/ directory and add the following:
# REACT_APP_BACKEND_URL="http://localhost:8000"

# Start the frontend development server
yarn start
```
The frontend will be running at `http://localhost:3000`.

## Production Server Environment

To deploy this application to a production server, you will need to:

### 1. Backend Deployment

*   **Web Server:** Use a production-grade web server like Gunicorn to run the Uvicorn workers.
    ```bash
    gunicorn -w 4 -k uvicorn.workers.UvicornWorker server:app
    ```
*   **Database:** Ensure the `MONGO_URL` environment variable is set to your production MongoDB instance.
*   **CORS:** Update the `CORS_ORIGINS` environment variable to the domain of your frontend application.
*   **Environment Variables:** It is recommended to use a secret management system to handle your environment variables in production.

### 2. Frontend Deployment

*   **Build the Application:** Create a production-ready build of the React app.
    ```bash
    cd frontend
    yarn build
    ```
*   **Serve the Static Files:** The `build` command will create a `build` directory with static HTML, CSS, and JS files. Serve this directory using a web server like Nginx or a static hosting service.
*   **Environment Variables:** The `REACT_APP_BACKEND_URL` will be baked in at build time. Ensure it is set to the public URL of your deployed backend API before running the `yarn build` command.
