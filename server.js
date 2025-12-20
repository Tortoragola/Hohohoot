require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const PORT = process.env.PORT || 3000;
const GAME_CLEANUP_DELAY = 60000; // 1 minute in milliseconds
const COUNTDOWN_DURATION = 3; // 3-second countdown before question starts on client

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json()); // JSON body parser for API routes

// ============ API ROUTES ============

// Get all quizzes (public - for quiz selection)
app.get('/api/quizzes', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('quizzes')
      .select('id, title, description, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching quizzes:', error);
    res.status(500).json({ error: 'Failed to fetch quizzes' });
  }
});

// Get single quiz with questions
app.get('/api/quizzes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('quizzes')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Quiz not found' });
    }
    res.json(data);
  } catch (error) {
    console.error('Error fetching quiz:', error);
    res.status(500).json({ error: 'Failed to fetch quiz' });
  }
});

// ============ FALLBACK QUESTIONS ============

// Fallback hardcoded questions (used if no quiz selected or DB fails)
const FALLBACK_QUESTIONS = [
  {
    id: 1,
    question: "İnternet protokol yığınında, datagramları kaynak–hedef arasında yönlendirme (routing) görevi hangi katmandadır?",
    answers: ["Application", "Transport", "Network", "Physical"],
    correctAnswer: 2, // Index of correct answer (Network)
    colors: ["red", "blue", "yellow", "green"]
  },
  {
    id: 2,
    question: "Circuit switching (devre anahtarlama) için hangisi doğrudur?",
    answers: [
      "Kaynaklar uçtan uca “çağrı” için ayrılır/rezerve edilir, paylaşım yoktur",
      "Her paket bağımsız iletilir, kaynak rezervasyonu yapılmaz",
      "Trafik artınca paketler kuyruklanır ve tampon dolarsa düşer",
      "Paketlerin tamamı router’a gelmeden sonraki linke iletilebilir"
    ],
    correctAnswer: 0, // Index of correct answer
    colors: ["red", "blue", "yellow", "green"]
  },
  {
    id: 3,
    question: "Bir linke gelen varış hızı, bir süre iletim hızını aşarsa router’da ne olabilir?",
    answers: [
      "Paketler kuyruklanır; tampon dolarsa paket kaybı (drop) olabilir",
      "Gecikme sıfıra yaklaşır",
      "Paketler otomatik olarak sıkıştırılır, kayıp olmaz",
      "Router her zaman daha hızlı iletime geçer"
    ],
    correctAnswer: 0, // Index of correct answer
    colors: ["red", "blue", "yellow", "green"]
  },
  {
    id: 4,
    question: "Client-server paradigması için en uygun ifade hangisidir?",
    answers: [
      "İstemciler (clients) genelde doğrudan birbirleriyle haberleşir",
      "Sunucu (server) her zaman açık olabilir; istemciler sunucuya bağlanıp iletişim kurar",
      "Sunucunun kalıcı IP’si olmak zorunda değildir",
      "Bu mimaride “server” diye bir kavram yoktur"
    ],
    correctAnswer: 1, // Index of correct answer
    colors: ["red", "blue", "yellow", "green"]
  },
  {
    id: 5,
    question: "Bir host üzerindeki bir process’i adreslemek için aşağıdakilerden hangisi gerekir?",
    answers: [
      "Sadece IP adresi",
      "Sadece port numarası",
      "IP adresi + port numarası",
      "Sadece MAC adresi"
    ],
    correctAnswer: 2, // Index of correct answer
    colors: ["red", "blue", "yellow", "green"]
  },
  {
    id: 6,
    question: "HTTP’nin “stateless” olması ne demektir?",
    answers: [
      "Sunucu, önceki istemci istekleri hakkında bilgi tutmaz",
      "HTTP, UDP kullanır ve bağlantı kurmaz",
      "HTTP mesajları şifreli gönderilir",
      "HTTP sadece tek bir nesne (object) indirebilir"
    ],
    correctAnswer: 0, // Index of correct answer
    colors: ["red", "blue", "yellow", "green"]
  },
  {
    id: 7,
    question: "Non-persistent HTTP ile Persistent HTTP arasındaki temel fark hangisidir?",
    answers: [
      "Non-persistent: tek TCP bağlantısı ile birden fazla nesne taşır",
      "Persistent: her nesne için yeni TCP bağlantısı açar",
      "Non-persistent: en fazla bir nesne/response için TCP bağlantısı açılır ve kapanır",
      "Persistent: TCP kullanmaz, sadece UDP kullanır"
    ],
    correctAnswer: 2, // Index of correct answer
    colors: ["red", "blue", "yellow", "green"]
  },
  {
    id: 8,
    question: "UDP ile ilgili doğru ifade hangisidir?",
    answers: [
      "Bağlantı yönelimlidir; el sıkışma (handshaking) zorunludur",
      "“Best effort”tır; segmentler kaybolabilir veya sırasız gelebilir; bağlantısızdır",
      "Her zaman güvenilir ve sıralı teslimat sağlar",
      "Akış kontrolü ve tıkanıklık kontrolü zorunlu olarak vardır"
    ],
    correctAnswer: 1, // Index of correct answer
    colors: ["red", "blue", "yellow", "green"]
  },
  {
    id: 9,
    question: "TCP için doğru ifade hangisidir?",
    answers: [
      "Mesaj sınırlarını koruyan “message-oriented” bir protokoldür",
      "Bağlantısızdır ve el sıkışma yapmaz",
      "Bağlantı yönelimlidir; güvenilir ve sıralı “byte stream” sağlar",
      "Yalnızca DNS gibi uygulamalar için tasarlanmıştır"
    ],
    correctAnswer: 2, // Index of correct answer
    colors: ["red", "blue", "yellow", "green"]
  },
  {
    id: 10,
    question: "SDN (Software-Defined Networking) kontrol düzlemi yaklaşımını en iyi hangisi açıklar?",
    answers: [
      "Her router kendi routing hesabını tamamen bağımsız yapar, merkezi yapı yoktur",
      "Uzak bir controller, forwarding tablolarını hesaplar ve router/switch’lere kurar (logically centralized)",
      "Sadece application layer’da çalışan bir protokoldür",
      "IP yönlendirmesi yerine fiziksel katman üzerinden yönlendirme yapar"
    ],
    correctAnswer: 1, // Index of correct answer
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

// Store question timers
const questionTimers = {};

// Function to reveal correct answer (when all players answered or timer expires)
function autoRevealAnswer(pin) {
  const game = games[pin];
  if (!game || game.state !== GameState.QUESTION) {
    return;
  }

  // Clear the timer if exists
  if (questionTimers[pin]) {
    clearTimeout(questionTimers[pin]);
    delete questionTimers[pin];
  }

  // Don't change state - host still needs to click "Show Results"
  // Just reveal the correct answer

  const question = game.questions[game.currentQuestionIndex];

  // Build playerResults map for players to see their own result
  const playerResults = {};
  for (const playerId of Object.keys(game.players)) {
    const answer = game.answers[playerId];
    const player = game.players[playerId];
    if (answer) {
      playerResults[playerId] = {
        answered: true,
        correct: answer.isCorrect,
        totalScore: player.score
      };
    } else {
      playerResults[playerId] = {
        answered: false,
        correct: false,
        totalScore: player.score
      };
    }
  }

  // Send reveal event - host shows correct answer, players see their result
  io.to(pin).emit('answer-revealed', {
    correctAnswer: question.correctAnswer,
    correctAnswerText: question.answers[question.correctAnswer],
    playerResults: playerResults
  });

  console.log(`Answer revealed for question ${game.currentQuestionIndex + 1} in game ${pin}`);
}

// Function to start question timer
function startQuestionTimer(pin, duration) {
  // Clear existing timer
  if (questionTimers[pin]) {
    clearTimeout(questionTimers[pin]);
  }

  // Set new timer
  questionTimers[pin] = setTimeout(() => {
    autoRevealAnswer(pin);
  }, duration * 1000);
}

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Host creates a new game
  socket.on('host-create-game', async ({ questions = null, quizId = null } = {}) => {
    const pin = generatePIN();

    // Validate questions if provided
    let gameQuestions = FALLBACK_QUESTIONS; // Default to fallback questions

    // If quizId is provided, fetch from Supabase
    if (quizId) {
      try {
        const { data, error } = await supabase
          .from('quizzes')
          .select('questions')
          .eq('id', quizId)
          .single();

        if (error) throw error;
        if (data && data.questions) {
          // Convert from DB format to game format
          gameQuestions = data.questions.map((q, index) => ({
            id: index + 1,
            question: q.question,
            answers: q.answers,
            correctAnswer: q.correctAnswer,
            colors: ["red", "blue", "yellow", "green"]
          }));
        }
      } catch (error) {
        console.error('Error fetching quiz from DB:', error);
        socket.emit('error', { message: 'Failed to load quiz from database' });
        return;
      }
    } else if (questions && Array.isArray(questions)) {
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
      const isValid = questions.every((q) => {
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
      questions: gameQuestions, // Store questions for this game
      answerTimeLimit: 20, // Default 20 seconds
      questionStartTime: null // Track when question was shown
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
  socket.on('host-start-game', ({ pin, answerTimeLimit }) => {
    // Input validation
    if (!pin || typeof pin !== 'string' || !/^\d{6}$/.test(pin)) {
      socket.emit('error', { message: 'Invalid PIN format' });
      return;
    }

    // Validate answerTimeLimit
    const timeLimit = parseInt(answerTimeLimit);
    if (isNaN(timeLimit) || timeLimit < 5 || timeLimit > 120) {
      socket.emit('error', { message: 'Answer time must be between 5 and 120 seconds' });
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
    game.answerTimeLimit = timeLimit;
    // Set questionStartTime 3 seconds in future to account for client countdown
    game.questionStartTime = Date.now() + (COUNTDOWN_DURATION * 1000);

    const question = game.questions[game.currentQuestionIndex];

    // Send question to host
    io.to(game.hostId).emit('question-display', {
      question: question.question,
      answers: question.answers,
      questionNumber: game.currentQuestionIndex + 1,
      totalQuestions: game.questions.length,
      totalPlayers: Object.keys(game.players).length
    });

    // Send signal to players to show answer buttons
    io.to(pin).emit('show-question', {
      questionNumber: game.currentQuestionIndex + 1,
      totalQuestions: game.questions.length
    });

    // Start auto-results timer (add countdown duration to account for client countdown)
    startQuestionTimer(pin, timeLimit + COUNTDOWN_DURATION);

    console.log(`Game ${pin} started with ${timeLimit}s answer time`);
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

    // Check if time has expired
    if (!game.questionStartTime) {
      // Question start time not set, reject answer
      socket.emit('answer-rejected', { reason: 'Unable to process answer due to timing initialization error' });
      return;
    }

    const currentTime = Date.now();
    const timeElapsed = (currentTime - game.questionStartTime) / 1000; // in seconds

    if (timeElapsed > game.answerTimeLimit) {
      // Time's up - don't accept the answer
      socket.emit('answer-rejected', { reason: 'Time expired' });
      return;
    }

    // Record answer if not already answered
    if (!game.answers[socket.id]) {
      const question = game.questions[game.currentQuestionIndex];
      const isCorrect = answerIndex === question.correctAnswer;

      game.answers[socket.id] = {
        answerIndex: answerIndex,
        isCorrect: isCorrect,
        timestamp: currentTime,
        timeElapsed: timeElapsed
      };

      // Calculate time-based points (Kahoot-style scoring)
      // Base points: 1000 for correct answer
      // Time bonus: up to 1000 additional points based on speed
      // Formula: basePoints + max(0, timeBonus * (1 - timeElapsed / timeLimit))
      // The Math.max ensures no negative time bonus if elapsed time exceeds limit
      if (isCorrect) {
        const basePoints = 1000;
        const timeBonus = 1000;
        const timeRatio = Math.max(0, 1 - (timeElapsed / game.answerTimeLimit));
        const totalPoints = Math.round(basePoints + (timeBonus * timeRatio));

        game.players[socket.id].score += totalPoints;

        console.log(`Player ${game.players[socket.id].nickname} earned ${totalPoints} points (${timeElapsed.toFixed(2)}s)`);
      }

      // Confirm to player
      socket.emit('answer-recorded');

      // Broadcast answer count to host and all players who have answered
      const totalPlayers = Object.keys(game.players).length;
      const answeredCount = Object.keys(game.answers).length;

      // Send to host
      io.to(game.hostId).emit('answer-count-update', {
        answered: answeredCount,
        total: totalPlayers
      });

      // Send to all players who have answered
      Object.keys(game.answers).forEach(playerId => {
        io.to(playerId).emit('answer-count-update', {
          answered: answeredCount,
          total: totalPlayers
        });
      });

      console.log(`Player ${game.players[socket.id].nickname} answered question ${game.currentQuestionIndex + 1}`);

      // Check if everyone has answered - auto reveal correct answer
      if (answeredCount >= totalPlayers) {
        console.log(`All players answered in game ${pin}, revealing answer`);
        autoRevealAnswer(pin);
      }
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

    // Clear the auto-results timer since host manually triggered
    if (questionTimers[pin]) {
      clearTimeout(questionTimers[pin]);
      delete questionTimers[pin];
    }

    game.state = GameState.RESULT;

    if (game.currentQuestionIndex < 0 || game.currentQuestionIndex >= game.questions.length) {
      socket.emit('error', { message: 'Invalid question state' });
      return;
    }
    const question = game.questions[game.currentQuestionIndex];

    // Calculate results

    // Sort by score for leaderboard
    const leaderboard = calculateLeaderboard(game);

    // Build playerResults map
    const playerResults = {};
    for (const playerId of Object.keys(game.players)) {
      const answer = game.answers[playerId];
      const player = game.players[playerId];
      if (answer) {
        playerResults[playerId] = {
          answered: true,
          correct: answer.isCorrect,
          totalScore: player.score
        };
      } else {
        playerResults[playerId] = {
          answered: false,
          correct: false,
          totalScore: player.score
        };
      }
    }

    // Send results to everyone
    io.to(pin).emit('question-results', {
      correctAnswer: question.correctAnswer,
      correctAnswerText: question.answers[question.correctAnswer],
      leaderboard: leaderboard,
      playerResults: playerResults
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

      // Clear timer
      if (questionTimers[pin]) {
        clearTimeout(questionTimers[pin]);
        delete questionTimers[pin];
      }

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
      // Set questionStartTime 3 seconds in future to account for client countdown
      game.questionStartTime = Date.now() + (COUNTDOWN_DURATION * 1000);

      const question = game.questions[game.currentQuestionIndex];

      // Send question to host
      io.to(game.hostId).emit('question-display', {
        question: question.question,
        answers: question.answers,
        questionNumber: game.currentQuestionIndex + 1,
        totalQuestions: game.questions.length,
        answerTimeLimit: game.answerTimeLimit,
        totalPlayers: Object.keys(game.players).length
      });

      // Send signal to players
      io.to(pin).emit('show-question', {
        questionNumber: game.currentQuestionIndex + 1,
        totalQuestions: game.questions.length,
        answerTimeLimit: game.answerTimeLimit
      });

      // Start auto-results timer for next question (add countdown duration)
      startQuestionTimer(pin, game.answerTimeLimit + COUNTDOWN_DURATION);

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

    // Clear timer
    if (questionTimers[pin]) {
      clearTimeout(questionTimers[pin]);
      delete questionTimers[pin];
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
