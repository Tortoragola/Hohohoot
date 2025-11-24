const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Hardcoded questions
const QUESTIONS = [
  {
    id: 1,
    question: "What is the capital of France?",
    answers: ["London", "Berlin", "Paris", "Madrid"],
    correctAnswer: 2, // Index of correct answer (Paris)
    colors: ["red", "blue", "yellow", "green"]
  },
  {
    id: 2,
    question: "Which planet is known as the Red Planet?",
    answers: ["Venus", "Mars", "Jupiter", "Saturn"],
    correctAnswer: 1, // Index of correct answer (Mars)
    colors: ["red", "blue", "yellow", "green"]
  },
  {
    id: 3,
    question: "What is 2 + 2?",
    answers: ["3", "4", "5", "6"],
    correctAnswer: 1, // Index of correct answer (4)
    colors: ["red", "blue", "yellow", "green"]
  },
  {
    id: 4,
    question: "Who painted the Mona Lisa?",
    answers: ["Van Gogh", "Picasso", "Da Vinci", "Rembrandt"],
    correctAnswer: 2, // Index of correct answer (Da Vinci)
    colors: ["red", "blue", "yellow", "green"]
  },
  {
    id: 5,
    question: "What is the largest ocean on Earth?",
    answers: ["Atlantic", "Indian", "Arctic", "Pacific"],
    correctAnswer: 3, // Index of correct answer (Pacific)
    colors: ["red", "blue", "yellow", "green"]
  }
];

// Game state management
const games = {}; // Store active games by PIN

// Generate random 6-digit PIN
function generatePIN() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Game states
const GameState = {
  LOBBY: 'LOBBY',
  QUESTION: 'QUESTION',
  RESULT: 'RESULT',
  ENDED: 'ENDED'
};

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Host creates a new game
  socket.on('host-create-game', () => {
    const pin = generatePIN();
    
    games[pin] = {
      pin: pin,
      hostId: socket.id,
      state: GameState.LOBBY,
      players: {},
      currentQuestionIndex: -1,
      answers: {} // Track player answers for current question
    };

    socket.join(pin);
    socket.emit('game-created', { pin: pin });
    console.log(`Game created with PIN: ${pin}`);
  });

  // Player joins a game
  socket.on('player-join', ({ pin, nickname }) => {
    const game = games[pin];
    
    if (!game) {
      socket.emit('error', { message: 'Game not found' });
      return;
    }

    if (game.state !== GameState.LOBBY) {
      socket.emit('error', { message: 'Game already started' });
      return;
    }

    // Add player to game
    game.players[socket.id] = {
      id: socket.id,
      nickname: nickname,
      score: 0
    };

    socket.join(pin);
    socket.emit('join-success', { pin: pin, nickname: nickname });

    // Notify host of new player
    io.to(game.hostId).emit('player-joined', {
      players: Object.values(game.players),
      playerCount: Object.keys(game.players).length
    });

    console.log(`Player ${nickname} joined game ${pin}`);
  });

  // Host starts the game
  socket.on('host-start-game', ({ pin }) => {
    const game = games[pin];
    
    if (!game || game.hostId !== socket.id) {
      socket.emit('error', { message: 'Unauthorized or game not found' });
      return;
    }

    game.state = GameState.QUESTION;
    game.currentQuestionIndex = 0;
    game.answers = {};

    const question = QUESTIONS[game.currentQuestionIndex];
    
    // Send question to host
    io.to(game.hostId).emit('question-display', {
      question: question.question,
      answers: question.answers,
      questionNumber: game.currentQuestionIndex + 1,
      totalQuestions: QUESTIONS.length
    });

    // Send signal to players to show answer buttons
    io.to(pin).emit('show-question', {
      questionNumber: game.currentQuestionIndex + 1,
      totalQuestions: QUESTIONS.length
    });

    console.log(`Game ${pin} started`);
  });

  // Player submits answer
  socket.on('player-answer', ({ pin, answerIndex }) => {
    const game = games[pin];
    
    if (!game || !game.players[socket.id]) {
      return;
    }

    // Record answer if not already answered
    if (!game.answers[socket.id]) {
      const question = QUESTIONS[game.currentQuestionIndex];
      const isCorrect = answerIndex === question.correctAnswer;
      
      game.answers[socket.id] = {
        answerIndex: answerIndex,
        isCorrect: isCorrect,
        timestamp: Date.now()
      };

      // Award points (correct answer = 1000 points, could add time bonus later)
      if (isCorrect) {
        game.players[socket.id].score += 1000;
      }

      // Confirm to player
      socket.emit('answer-recorded');
      
      console.log(`Player ${game.players[socket.id].nickname} answered question ${game.currentQuestionIndex + 1}`);
    }
  });

  // Host shows results
  socket.on('host-show-results', ({ pin }) => {
    const game = games[pin];
    
    if (!game || game.hostId !== socket.id) {
      return;
    }

    game.state = GameState.RESULT;

    const question = QUESTIONS[game.currentQuestionIndex];
    
    // Calculate results
    const results = Object.entries(game.answers).map(([playerId, answer]) => ({
      nickname: game.players[playerId].nickname,
      isCorrect: answer.isCorrect,
      score: game.players[playerId].score
    }));

    // Sort by score for leaderboard
    const leaderboard = Object.values(game.players)
      .sort((a, b) => b.score - a.score)
      .map((player, index) => ({
        rank: index + 1,
        nickname: player.nickname,
        score: player.score
      }));

    // Send results to everyone
    io.to(pin).emit('question-results', {
      correctAnswer: question.correctAnswer,
      correctAnswerText: question.answers[question.correctAnswer],
      leaderboard: leaderboard
    });

    console.log(`Results shown for question ${game.currentQuestionIndex + 1} in game ${pin}`);
  });

  // Host advances to next question
  socket.on('host-next-question', ({ pin }) => {
    const game = games[pin];
    
    if (!game || game.hostId !== socket.id) {
      return;
    }

    game.currentQuestionIndex++;
    
    if (game.currentQuestionIndex >= QUESTIONS.length) {
      // Game ended
      game.state = GameState.ENDED;
      
      const finalLeaderboard = Object.values(game.players)
        .sort((a, b) => b.score - a.score)
        .map((player, index) => ({
          rank: index + 1,
          nickname: player.nickname,
          score: player.score
        }));

      io.to(pin).emit('game-ended', {
        leaderboard: finalLeaderboard
      });

      console.log(`Game ${pin} ended`);
    } else {
      // Show next question
      game.state = GameState.QUESTION;
      game.answers = {};

      const question = QUESTIONS[game.currentQuestionIndex];
      
      // Send question to host
      io.to(game.hostId).emit('question-display', {
        question: question.question,
        answers: question.answers,
        questionNumber: game.currentQuestionIndex + 1,
        totalQuestions: QUESTIONS.length
      });

      // Send signal to players
      io.to(pin).emit('show-question', {
        questionNumber: game.currentQuestionIndex + 1,
        totalQuestions: QUESTIONS.length
      });

      console.log(`Next question shown in game ${pin}`);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    // Check if it's a host disconnecting
    Object.keys(games).forEach(pin => {
      const game = games[pin];
      
      if (game.hostId === socket.id) {
        // Host disconnected, end game
        io.to(pin).emit('host-disconnected');
        delete games[pin];
        console.log(`Game ${pin} deleted (host disconnected)`);
      } else if (game.players[socket.id]) {
        // Player disconnected
        const nickname = game.players[socket.id].nickname;
        delete game.players[socket.id];
        
        io.to(game.hostId).emit('player-left', {
          players: Object.values(game.players),
          playerCount: Object.keys(game.players).length
        });
        
        console.log(`Player ${nickname} left game ${pin}`);
      }
    });
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Host interface: http://localhost:${PORT}/host.html`);
  console.log(`Player interface: http://localhost:${PORT}/player.html`);
});
