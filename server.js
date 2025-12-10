const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const PORT = process.env.PORT || 3000;
const GAME_CLEANUP_DELAY = 60000; // 1 minute in milliseconds

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
  let pin;
  do {
    pin = Math.floor(100000 + Math.random() * 900000).toString();
  } while (games[pin]);
  return pin;
}

// Game states
const GameState = {
  LOBBY: 'LOBBY',
  QUESTION: 'QUESTION',
  RESULT: 'RESULT',
  ENDED: 'ENDED'
};

// Calculate leaderboard from game players
function calculateLeaderboard(game) {
  return Object.values(game.players)
    .sort((a, b) => b.score - a.score)
    .map((player, index) => ({
      rank: index + 1,
      nickname: player.nickname,
      score: player.score
    }));
}

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Host creates a new game
  socket.on('host-create-game', ({ questions }) => {
    const pin = generatePIN();
    
    // Validate questions if provided
    let gameQuestions = QUESTIONS; // Default to hardcoded questions
    
    if (questions && Array.isArray(questions)) {
      // Validate custom questions
      if (questions.length === 0) {
        socket.emit('error', { message: 'At least one question is required' });
        return;
      }
      
      if (questions.length > 50) {
        socket.emit('error', { message: 'Maximum 50 questions allowed' });
        return;
      }
      
      // Validate each question
      const isValid = questions.every((q, index) => {
        if (!q.question || typeof q.question !== 'string' || q.question.trim().length === 0) {
          return false;
        }
        if (!Array.isArray(q.answers) || q.answers.length !== 4) {
          return false;
        }
        if (!q.answers.every(a => typeof a === 'string' && a.trim().length > 0)) {
          return false;
        }
        if (typeof q.correctAnswer !== 'number' || q.correctAnswer < 0 || q.correctAnswer > 3) {
          return false;
        }
        return true;
      });
      
      if (!isValid) {
        socket.emit('error', { message: 'Invalid question format' });
        return;
      }
      
      // Use custom questions with proper structure
      gameQuestions = questions.map((q, index) => ({
        id: index + 1,
        question: q.question.trim(),
        answers: q.answers.map(a => a.trim()),
        correctAnswer: q.correctAnswer,
        colors: ["red", "blue", "yellow", "green"]
      }));
    }
    
    games[pin] = {
      pin: pin,
      hostId: socket.id,
      state: GameState.LOBBY,
      players: {},
      currentQuestionIndex: -1,
      answers: {}, // Track player answers for current question
      questions: gameQuestions // Store questions for this game
    };

    socket.join(pin);
    socket.emit('game-created', { pin: pin });
    console.log(`Game created with PIN: ${pin} (${gameQuestions.length} questions)`);
  });

  // Player joins a game
  socket.on('player-join', ({ pin, nickname }) => {
    // Input validation
    if (!pin || typeof pin !== 'string' || !/^\d{6}$/.test(pin)) {
      socket.emit('error', { message: 'Invalid PIN format' });
      return;
    }
    
    if (!nickname || typeof nickname !== 'string' || nickname.trim().length === 0) {
      socket.emit('error', { message: 'Nickname is required' });
      return;
    }
    
    if (nickname.length > 20) {
      socket.emit('error', { message: 'Nickname too long (max 20 characters)' });
      return;
    }
    
    // Sanitize nickname
    const sanitizedNickname = nickname.trim().substring(0, 20);
    
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
      nickname: sanitizedNickname,
      score: 0
    };

    socket.join(pin);
    socket.emit('join-success', { pin: pin, nickname: sanitizedNickname });

    // Notify host of new player
    io.to(game.hostId).emit('player-joined', {
      players: Object.values(game.players),
      playerCount: Object.keys(game.players).length
    });

    console.log(`Player ${sanitizedNickname} joined game ${pin}`);
  });

  // Host starts the game
  socket.on('host-start-game', ({ pin }) => {
    // Input validation
    if (!pin || typeof pin !== 'string' || !/^\d{6}$/.test(pin)) {
      socket.emit('error', { message: 'Invalid PIN format' });
      return;
    }
    
    const game = games[pin];
    
    if (!game || game.hostId !== socket.id) {
      socket.emit('error', { message: 'Unauthorized or game not found' });
      return;
    }

    game.state = GameState.QUESTION;
    game.currentQuestionIndex = 0;
    game.answers = {};

    const question = game.questions[game.currentQuestionIndex];
    
    // Send question to host
    io.to(game.hostId).emit('question-display', {
      question: question.question,
      answers: question.answers,
      questionNumber: game.currentQuestionIndex + 1,
      totalQuestions: game.questions.length
    });

    // Send signal to players to show answer buttons
    io.to(pin).emit('show-question', {
      questionNumber: game.currentQuestionIndex + 1,
      totalQuestions: game.questions.length
    });

    console.log(`Game ${pin} started`);
  });

  // Player submits answer
  socket.on('player-answer', ({ pin, answerIndex }) => {
    const game = games[pin];
    
    if (!game || !game.players[socket.id]) {
      return;
    }
    
    // Validate game state
    if (game.state !== GameState.QUESTION) {
      return;
    }
    
    // Validate answer index
    if (typeof answerIndex !== 'number' || !Number.isInteger(answerIndex)) {
      return;
    }
    
    if (answerIndex < 0 || answerIndex >= 4) {
      return;
    }

    // Record answer if not already answered
    if (!game.answers[socket.id]) {
      const question = game.questions[game.currentQuestionIndex];
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
    // Input validation
    if (!pin || typeof pin !== 'string' || !/^\d{6}$/.test(pin)) {
      socket.emit('error', { message: 'Invalid PIN format' });
      return;
    }
    
    const game = games[pin];
    
    if (!game || game.hostId !== socket.id) {
      return;
    }

    game.state = GameState.RESULT;

    if (game.currentQuestionIndex < 0 || game.currentQuestionIndex >= game.questions.length) {
      socket.emit('error', { message: 'Invalid question state' });
      return;
    }
    const question = game.questions[game.currentQuestionIndex];
    
    // Calculate results
    const results = Object.entries(game.answers).map(([playerId, answer]) => {
      const player = game.players[playerId];
      return player ? {
        nickname: player.nickname,
        isCorrect: answer.isCorrect,
        score: player.score
      } : null;
    }).filter(result => result !== null);

    // Sort by score for leaderboard
    const leaderboard = calculateLeaderboard(game);

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
    // Input validation
    if (!pin || typeof pin !== 'string' || !/^\d{6}$/.test(pin)) {
      socket.emit('error', { message: 'Invalid PIN format' });
      return;
    }
    
    const game = games[pin];
    
    if (!game || game.hostId !== socket.id) {
      return;
    }

    game.currentQuestionIndex++;
    
    if (game.currentQuestionIndex >= game.questions.length) {
      // Game ended
      game.state = GameState.ENDED;
      
      const finalLeaderboard = calculateLeaderboard(game);

      io.to(pin).emit('game-ended', {
        leaderboard: finalLeaderboard
      });

      // Schedule cleanup of the game after 1 minute
      setTimeout(() => {
        delete games[pin];
        console.log(`Game ${pin} cleaned up`);
      }, GAME_CLEANUP_DELAY);
      console.log(`Game ${pin} ended`);
    } else {
      // Show next question
      game.state = GameState.QUESTION;
      game.answers = {};

      const question = game.questions[game.currentQuestionIndex];
      
      // Send question to host
      io.to(game.hostId).emit('question-display', {
        question: question.question,
        answers: question.answers,
        questionNumber: game.currentQuestionIndex + 1,
        totalQuestions: game.questions.length
      });

      // Send signal to players
      io.to(pin).emit('show-question', {
        questionNumber: game.currentQuestionIndex + 1,
        totalQuestions: game.questions.length
      });

      console.log(`Next question shown in game ${pin}`);
    }
  });

  // Host ends session
  socket.on('host-end-session', ({ pin }) => {
    // Input validation
    if (!pin || typeof pin !== 'string' || !/^\d{6}$/.test(pin)) {
      socket.emit('error', { message: 'Invalid PIN format' });
      return;
    }
    
    const game = games[pin];
    
    if (!game || game.hostId !== socket.id) {
      socket.emit('error', { message: 'Unauthorized or game not found' });
      return;
    }

    // Calculate final leaderboard before ending
    const finalLeaderboard = calculateLeaderboard(game);

    // Set game state to ended
    game.state = GameState.ENDED;

    // Notify all participants that the game has ended
    io.to(pin).emit('game-ended', {
      leaderboard: finalLeaderboard
    });

    console.log(`Game ${pin} ended by host`);

    // Clean up game after a short delay
    setTimeout(() => {
      delete games[pin];
      console.log(`Game ${pin} cleaned up`);
    }, GAME_CLEANUP_DELAY);
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
