# HealthSync Comprehensive

A full-stack health monitoring application with AI-powered agents, built with **Next.js** frontend and **Flask API** backend.

## Features

- 🏥 **Dashboard** - Real-time patient status overview
- 📅 **Calendar** - View and manage health events
- 🔔 **Reminders** - Track pending health tasks
- 😴 **Sleep Tracker** - Record and analyze sleep patterns
- 💊 **Medication Scheduler** - Schedule and track medications
- 📹 **Video Call** - Connect with patients remotely
- 🤖 **AI Agents** - Sleep, Medication, ML, Assistant, and Reminder agents
- 📧 **Communication** - Email, WhatsApp, and phone integration

## Tech Stack

- **Frontend**: Next.js 15, React 19, CSS Modules
- **Backend**: Flask, Flask-SocketIO, Flask-CORS
- **Database**: SQLite
- **ML**: scikit-learn, pandas, numpy
- **Communication**: Twilio (WhatsApp, Phone)

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.10+

### Backend Setup

```bash
cd backend
pip install -r requirements.txt
python app.py
```

The API will run on `http://localhost:5000`

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The app will run on `http://localhost:3000`

### Environment Variables

Copy `.env` in the backend folder and configure:

- `SECRET_KEY` - JWT secret key
- `SMTP_*` - Email settings
- `TWILIO_*` - Twilio API credentials

## Default Login

- **Username**: `sarah`
- **Password**: `caregiver123`

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/token` | Login & get JWT token |
| GET | `/api/patient/{id}/status` | Get patient status |
| POST | `/api/patient/{id}/sleep` | Update sleep data |
| POST | `/api/patient/{id}/medication` | Schedule medication |
| POST | `/api/patient/{id}/vitals` | Update vital signs |
| POST | `/api/patient/{id}/communicate` | Send email/WhatsApp/call |
| GET | `/api/patient/{id}/events` | Get calendar events |
| PUT | `/api/events/{id}` | Update event status |
| GET | `/api/patient/{id}/recommendations` | Get AI recommendations |

## Project Structure

```
HealthSync-Comprehensive/
├── backend/
│   ├── agents/          # AI agents
│   ├── utils/           # Communication utilities
│   ├── app.py           # Flask API
│   ├── database.py      # SQLite database
│   └── config.py        # Configuration
├── frontend/
│   ├── src/
│   │   ├── app/         # Next.js pages
│   │   └── components/  # React components
│   └── next.config.mjs  # API proxy config
└── README.md
```

## License

MIT
