# Hohohoot 🎯

A real-time multiplayer quiz platform built with Node.js, Socket.io, and PostgreSQL (Supabase). Create, save, and play interactive quizzes with live scoring and instant WebSocket updates. Features optional authentication for quiz management and public sharing.

## Features

- **🔐 Soft Authentication**: Optional login system - play as guest or sign up to save quizzes
- **📚 Quiz Management**: Create custom quizzes and save them to your account
- **🌐 Public & Private Quizzes**: Share quizzes publicly or keep them private
- **⚡ Real-time Synchronization**: Instant updates across all connected clients via WebSockets
- **🎮 Host Control**: Create games, display questions, manage game flow, and show leaderboards
- **📱 Player Controllers**: Simple 4-button color interface for answering questions
- **🔢 Room Management**: Unique 6-digit PINs for each game session
- **🎯 Game States**: Lobby → Question → Result flow with automatic progression
- **🏆 Live Leaderboard**: Real-time score tracking and rankings
- **📊 PostgreSQL Database**: Persistent quiz storage with Supabase
- **🎨 Responsive Design**: Works on desktop and mobile devices

## Architecture

### Backend (`server.js`)
- **Express Server**: REST API for quiz management
- **Socket.io**: Real-time game state management and player synchronization
- **Supabase Integration**: PostgreSQL database with Row Level Security (RLS)
- **Game State Management**: Handles Lobby, Question, Result, and Ended states
- **Room System**: Manages unique 6-digit PINs for game sessions
- **Score Tracking**: Calculates and broadcasts live leaderboards

### Database (Supabase PostgreSQL)
- **quizzes table**: Stores quiz data with user ownership
- **Row Level Security**: Public quizzes (user_id IS NULL) vs Private quizzes (user_id set)
- **Auth System**: Supabase Auth with email/password

### Host Client (`public/host.html`)
- **Authentication**: Optional login for quiz saving and management
- **My Quizzes**: Personal quiz library for logged-in users
- **Public Quizzes**: Browse and play community quizzes
- **Quiz Creator**: Build custom quizzes with multiple choice questions
- **Game Management**: Create rooms, display questions, control flow
- **Leaderboard Display**: Shows rankings after each question and final results

### Player Client (`public/player.html`)
- **PIN-based Join**: Enter 6-digit code to join games
- **Controller Interface**: 4 color buttons (🔴 🔵 🟡 🟢)
- **Real-time Updates**: Instant question delivery via WebSockets
- **Visual Feedback**: Answer confirmation and waiting states

### Auth System (`public/auth.html`)
- **Sign Up**: Create new accounts with email/password
- **Login**: Access saved quizzes and personal library
- **Guest Mode**: Play without authentication (quizzes not saved)

## Installation

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- Supabase account ([create free account](https://supabase.com))

### Setup Steps

```bash
# Clone the repository
git clone https://github.com/Tortoragola/Hohohoot.git
cd Hohohoot

# Install dependencies
npm install
```

### Environment Configuration

Create a `.env` file in the root directory:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here

# Server Configuration
PORT=3000
```

**Get Supabase credentials:**
1. Go to [Supabase Dashboard](https://app.supabase.co)
2. Select your project → Settings → API
3. Copy `Project URL` → `SUPABASE_URL`
4. Copy `anon public` key → `SUPABASE_ANON_KEY`

### Database Setup

1. Go to Supabase Dashboard → SQL Editor
2. Run the following SQL:

```sql
-- Create quizzes table
CREATE TABLE quizzes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  description TEXT,
  questions JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;

-- Anyone can read quizzes
CREATE POLICY "Anyone can read quizzes" 
ON quizzes FOR SELECT 
USING (true);

-- Anyone can create quizzes (guest or logged in)
CREATE POLICY "Anyone can create quizzes" 
ON quizzes FOR INSERT 
WITH CHECK (true);

-- Users can update own quizzes
CREATE POLICY "Users can update own quizzes" 
ON quizzes FOR UPDATE 
USING (auth.uid() = user_id);

-- Users can delete own quizzes
CREATE POLICY "Users can delete own quizzes" 
ON quizzes FOR DELETE 
USING (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX idx_quizzes_user_id ON quizzes(user_id);
CREATE INDEX idx_quizzes_created_at ON quizzes(created_at DESC);
```

3. Configure Supabase Auth:
   - Dashboard → Authentication → Settings
   - Enable **Email provider**
   - Set **Auto-confirm users: ON** (for development)
   - Add redirect URLs: `http://localhost:3000/host.html`

### Start the Server

```bash
npm start
```

Server runs on `http://localhost:3000`

## Usage

### For Hosts

#### Option 1: Guest Mode (No Login)
1. Open `http://localhost:3000` → Click "Host Game"
2. Select a public quiz or create a custom quiz
3. Game PIN generated automatically
4. Share PIN with players
5. Click "Start Game" when ready
6. **Note**: Guest-created quizzes are NOT saved

#### Option 2: Logged In Mode (Save Quizzes)
1. Open `http://localhost:3000/auth.html`
2. Sign up or log in with email/password
3. Access your personal quiz library in "My Quizzes"
4. Create and save custom quizzes
5. Choose quiz visibility:
   - **Public**: Visible to everyone (user_id = NULL in database)
   - **Private**: Only visible to you
6. Start games with saved quizzes

### For Players

1. Open `http://localhost:3000/player.html` on any device
2. Enter the 6-digit PIN shown on host screen
3. Enter your nickname
4. Wait in lobby for host to start
5. Answer questions using color buttons (🔴 🔵 🟡 🟢)
6. See your score on the leaderboard after each question

### Game Flow

```
HOST: Create/Select Quiz → Generate PIN → Wait in Lobby
         ↓
PLAYERS: Enter PIN → Join Lobby
         ↓
HOST: Start Game → Display Question
         ↓
PLAYERS: Select Answer (colored buttons)
         ↓
HOST: Show Results → Leaderboard
         ↓
HOST: Next Question → Repeat
         ↓
GAME ENDS: Final Leaderboard
```

## Technology Stack

- **Backend**: 
  - Node.js + Express (REST API)
  - Socket.io (Real-time communication)
  - dotenv (Environment variables)
  
- **Database**: 
  - PostgreSQL via Supabase
  - Row Level Security (RLS) policies
  - Supabase Auth (email/password)
  
- **Frontend**: 
  - HTML5, CSS3, Vanilla JavaScript
  - Supabase JavaScript Client
  
- **Deployment**: 
  - PM2 process manager
  - Environment-based configuration

## Project Structure

```
Hohohoot/
├── server.js                    # Express + Socket.io server
├── package.json                 # Dependencies and scripts
├── .env                         # Environment variables (not in git)
├── public/
│   ├── index.html              # Landing page
│   ├── auth.html               # Login/Signup page
│   ├── host.html               # Host interface (quiz management + game control)
│   ├── player.html             # Player controller interface
│   └── supabase-client.js      # Shared Supabase client configuration
├── supabase-auth-setup.sql     # Database schema and RLS policies
└── README.md                    # This file
```

## Game Flow

```
┌─────────────────────────────────────────────────────┐
│                      LOBBY                          │
│  - Host creates game & gets PIN                     │
│  - Players join with PIN + nickname                 │
│  - Host sees player list update in real-time        │
│  - Host starts game                                 │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│                    QUESTION                         │
│  - Host displays question text & answers            │
│  - Players see 4 color buttons instantly (WebSocket)│
│  - Players submit answers                           │
│  - Host shows results                               │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│                     RESULT                          │
│  - Show correct answer                              │
│  - Display leaderboard                              │
│  - Host advances to next question                   │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼ (repeat for all questions)
┌─────────────────────────────────────────────────────┐
│                   GAME ENDED                        │
│  - Show final leaderboard                           │
│  - Option to start new game                         │
└─────────────────────────────────────────────────────┘
```

## WebSocket Events

### Client → Server
- `host-create-game`: Create new game room with quiz data
- `player-join`: Join game with PIN and nickname
- `host-start-game`: Start the game (transitions from Lobby to Question)
- `player-answer`: Submit answer choice
- `host-show-results`: Show question results and leaderboard
- `host-next-question`: Advance to next question
- `disconnect`: Handle player/host disconnection

### Server → Client
- `game-created`: Game PIN assigned to host
- `player-joined`: Broadcast updated player list
- `player-left`: Player disconnected notification
- `question-display`: Show question to host screen
- `show-question`: Signal players to display answer buttons
- `answer-recorded`: Confirm answer received
- `question-results`: Display results & leaderboard
- `game-ended`: Final leaderboard and game completion
- `host-disconnected`: Game terminated by host leaving
- `no-game-found`: Invalid PIN error

## API Endpoints

### GET `/api/quizzes`
Fetch all quizzes (public and user's private quizzes)
```javascript
Response: [
  {
    id: "uuid",
    title: "Quiz Title",
    description: "Quiz description",
    created_at: "timestamp"
  }
]
```

### GET `/api/quizzes/:id`
Fetch single quiz with full questions
```javascript
Response: {
  id: "uuid",
  user_id: "uuid" | null,  // null = public quiz
  title: "Quiz Title",
  description: "Description",
  questions: [...],
  created_at: "timestamp"
}
```

## Production Deployment

### Using PM2

```bash
# Install PM2 globally
npm install -g pm2

# Start application
pm2 start server.js --name hohohoot

# View logs
pm2 logs hohohoot

# Restart with updated environment
pm2 restart hohohoot --update-env

# Save PM2 process list
pm2 save

# Auto-start on server reboot
pm2 startup
```

### Environment Variables
Ensure `.env` file is configured on production server:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-production-anon-key
PORT=3000
```

### Supabase Production Setup
1. Update **Site URL** in Supabase Auth settings to production domain
2. Add production redirect URLs (e.g., `https://yourdomain.com/host.html`)
3. Verify RLS policies are active
4. Monitor database usage in Supabase Dashboard

## Troubleshooting

### "Cannot find module 'dotenv'" Error
```bash
# Install dependencies on server
cd /path/to/Hohohoot
npm install
pm2 restart hohohoot
```

### "Invalid API key" Error
- Verify `.env` has correct `SUPABASE_ANON_KEY` (JWT format: `eyJhbGc...`)
- Get key from Supabase Dashboard → Settings → API → `anon public`

### PM2 Process Errored
```bash
# Check error logs
pm2 logs hohohoot --err --lines 50

# Verify environment loaded
pm2 restart hohohoot --update-env
```

### Authentication Not Working
- Check Supabase Auth settings: Email provider enabled
- Verify redirect URLs include your domain
- Check browser console for Supabase client errors

## License

MIT
