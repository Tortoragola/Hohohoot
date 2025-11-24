# Hohohoot 🎯

A real-time multiplayer quiz prototype built with Node.js and Socket.io. Replicates the Kahoot experience where a Host manages the game on a main screen while Players join via PIN and use their devices as controllers. Features instant WebSocket updates and live leaderboards.

## Features

- **Real-time Synchronization**: Instant updates across all connected clients via WebSockets
- **Host Control**: Create games, display questions, manage game flow, and show leaderboards
- **Player Controllers**: Simple 4-button color interface for answering questions
- **Room Management**: Unique 6-digit PINs for each game session
- **Game States**: Lobby → Question → Result flow with automatic progression
- **Live Leaderboard**: Real-time score tracking and rankings
- **Responsive Design**: Works on desktop and mobile devices

## Architecture

### Server (`server.js`)
- Manages game state (Lobby, Question, Result, Ended)
- Handles room management via unique Game PINs
- Contains 5 hardcoded quiz questions
- Broadcasts real-time updates to all connected clients
- Tracks player scores and leaderboard

### Host Client (`public/host.html`)
- Creates new game rooms with unique PINs
- Displays question text and answer options
- Shows player list and count in lobby
- Controls game flow (start game, show results, next question)
- Displays leaderboard after each question
- Shows final standings when game ends

### Player Client (`public/player.html`)
- Joins game via 6-digit PIN
- Acts as a controller with 4 color buttons (🔴 🔵 🟡 🟢)
- Instantly receives question updates via WebSockets
- Submits answers with visual feedback
- Shows waiting states between questions

## Installation

```bash
# Clone the repository
git clone https://github.com/Tortoragola/Hohohoot.git
cd Hohohoot

# Install dependencies
npm install

# Start the server
npm start
```

The server will start on port 3000 (or PORT environment variable).

## Usage

1. **Start the server**:
   ```bash
   npm start
   ```

2. **Host Setup**:
   - Open `http://localhost:3000/host.html` in a browser
   - A unique 6-digit PIN will be generated automatically
   - Share this PIN with players

3. **Player Setup**:
   - Players open `http://localhost:3000/player.html` on their devices
   - Enter the game PIN and a nickname
   - Wait in lobby for host to start

4. **Playing**:
   - Host clicks "Start Game" when ready
   - Questions appear on host screen, players see color buttons
   - Players tap their answer (red/blue/yellow/green)
   - Host clicks "Show Results" to display leaderboard
   - Host clicks "Next Question" to continue
   - Game ends after all 5 questions

## Technology Stack

- **Backend**: Node.js, Express, Socket.io
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Real-time Communication**: WebSockets (Socket.io)

## Project Structure

```
Hohohoot/
├── server.js              # Node.js server with Socket.io
├── package.json           # Dependencies and scripts
├── public/
│   ├── index.html        # Landing page
│   ├── host.html         # Host interface
│   └── player.html       # Player interface
└── README.md             # This file
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
- `host-create-game`: Create new game room
- `player-join`: Join game with PIN and nickname
- `host-start-game`: Start the game
- `player-answer`: Submit answer
- `host-show-results`: Show question results
- `host-next-question`: Advance to next question

### Server → Client
- `game-created`: Game PIN assigned
- `player-joined`: Player list updated
- `player-left`: Player disconnected
- `question-display`: Show question (host only)
- `show-question`: Signal to show buttons (players)
- `answer-recorded`: Confirm answer received
- `question-results`: Display results & leaderboard
- `game-ended`: Final leaderboard
- `host-disconnected`: Game terminated

## License

MIT
