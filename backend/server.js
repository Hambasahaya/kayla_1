const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const { processText } = require('./services/analyzer');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// In-memory session store
const activeSessions = {};

// HTTP endpoints
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    mode: 'active',
    sessionsCount: Object.keys(activeSessions).length
  });
});

app.post('/api/analyze', async (req, res) => {
  const { text, history, keys } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Text parameter is required' });
  }
  try {
    const result = await processText(text, history || [], keys);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sessions/clear', (req, res) => {
  Object.keys(activeSessions).forEach(key => delete activeSessions[key]);
  res.json({ message: 'All sessions cleared' });
});

// Setup HTTP Server & Socket.io
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // 1. Student joins a chat session
  socket.on('student-join', ({ sessionId, studentName }) => {
    if (!sessionId) return;
    
    socket.join(`session:${sessionId}`);
    
    if (!activeSessions[sessionId]) {
      activeSessions[sessionId] = {
        id: sessionId,
        studentName: studentName || 'Anonim',
        status: 'active', // 'active' or 'taken-over'
        createdAt: new Date(),
        messages: [],
        analysis: {
          emotion: 'Netral',
          sentiment: 'Netral',
          riskScore: 'Low',
          riskReason: 'Sesi baru dimulai.',
          riskFlags: [],
          actionPlan: ['Siswa baru saja membuka ruang obrolan.']
        }
      };
    }
    
    // Send back current session state to the joining student
    socket.emit('session-state', activeSessions[sessionId]);
    
    // Broadcast active sessions update to all counselors
    io.to('counselors').emit('counselor-sessions-update', Object.values(activeSessions));
  });

  // 2. Student sends a message
  socket.on('student-message', async ({ sessionId, text, userKeys }) => {
    const session = activeSessions[sessionId];
    if (!session) return;

    // Add student message to history
    const studentMsgObj = {
      id: Math.random().toString(36).substr(2, 9),
      sender: 'student',
      text,
      timestamp: new Date()
    };
    session.messages.push(studentMsgObj);

    // Notify counselors of new incoming student message
    io.to('counselors').emit('student-new-message', { sessionId, message: studentMsgObj });

    // Emit pipeline step update: Emotion analysis starting
    io.to(`session:${sessionId}`).to('counselors').emit('pipeline-step', {
      sessionId,
      step: 'emotion',
      status: 'processing'
    });

    // Run analyzer
    try {
      const history = session.messages.slice(0, -1);
      const result = await processText(text, history, userKeys);
      
      // Update session global analysis metrics
      session.analysis = {
        emotion: result.emotion,
        emotionScore: result.emotionScore,
        sentiment: result.sentiment,
        sentimentScore: result.sentimentScore,
        riskScore: result.riskScore,
        riskReason: result.riskReason,
        riskFlags: result.riskFlags,
        actionPlan: result.actionPlan,
        source: result.source
      };

      // Emit emotion complete
      io.to(`session:${sessionId}`).to('counselors').emit('pipeline-step', {
        sessionId,
        step: 'emotion',
        status: 'done',
        result: { value: result.emotion, score: result.emotionScore }
      });

      // Emit sentiment start/complete
      io.to(`session:${sessionId}`).to('counselors').emit('pipeline-step', {
        sessionId,
        step: 'sentiment',
        status: 'processing'
      });
      
      io.to(`session:${sessionId}`).to('counselors').emit('pipeline-step', {
        sessionId,
        step: 'sentiment',
        status: 'done',
        result: { value: result.sentiment, score: result.sentimentScore }
      });

      // Emit LLM & Risk evaluation complete
      io.to(`session:${sessionId}`).to('counselors').emit('pipeline-step', {
        sessionId,
        step: 'llm',
        status: 'processing'
      });

      io.to(`session:${sessionId}`).to('counselors').emit('pipeline-step', {
        sessionId,
        step: 'llm',
        status: 'done',
        result: {
          riskScore: result.riskScore,
          riskFlags: result.riskFlags,
          riskReason: result.riskReason,
          actionPlan: result.actionPlan
        }
      });

      // Attach the analysis to the student's message for history tracking
      studentMsgObj.analysis = {
        emotion: result.emotion,
        sentiment: result.sentiment,
        riskScore: result.riskScore
      };

      // Respond automatically with AI reply if not taken over by a counselor
      if (session.status === 'active') {
        const aiMsgObj = {
          id: Math.random().toString(36).substr(2, 9),
          sender: 'ai',
          text: result.empatheticResponse,
          timestamp: new Date()
        };
        session.messages.push(aiMsgObj);

        // Send to student
        io.to(`session:${sessionId}`).emit('bot-message', {
          message: aiMsgObj,
          analysis: session.analysis
        });
      } else {
        // If taken over, generate a silent AI suggestion response that ONLY the counselor can see to help them type!
        io.to('counselors').emit('counselor-ai-suggestion', {
          sessionId,
          suggestedResponse: result.empatheticResponse,
          analysis: session.analysis
        });
      }

      // Update all counselors with the new session metrics and state
      io.to('counselors').emit('counselor-sessions-update', Object.values(activeSessions));

    } catch (err) {
      console.error('Error in student-message analyzer:', err);
      // fallback fail notifications
      io.to(`session:${sessionId}`).to('counselors').emit('pipeline-step', {
        sessionId,
        step: 'error',
        message: 'Gagal menganalisis pesan'
      });
    }
  });

  // 3. Counselor connects and registers
  socket.on('counselor-join', () => {
    socket.join('counselors');
    // Send list of all active sessions
    socket.emit('counselor-sessions-update', Object.values(activeSessions));
  });

  // 4. Counselor takes over manual control of a session
  socket.on('counselor-take-over', ({ sessionId, value }) => {
    const session = activeSessions[sessionId];
    if (!session) return;

    session.status = value ? 'taken-over' : 'active';
    
    // Broadcast status change
    io.to(`session:${sessionId}`).to('counselors').emit('session-status-changed', {
      sessionId,
      status: session.status
    });

    // Notify about taking over in the chats as system logs
    const sysMsgObj = {
      id: Math.random().toString(36).substr(2, 9),
      sender: 'system',
      text: value 
        ? 'Guru BK masuk ke ruang obrolan. Mode manual aktif.' 
        : 'Guru BK meninggalkan ruang obrolan. Asisten Rumi kembali aktif.',
      timestamp: new Date()
    };
    session.messages.push(sysMsgObj);

    io.to(`session:${sessionId}`).to('counselors').emit('system-message', { sessionId, message: sysMsgObj });
    io.to('counselors').emit('counselor-sessions-update', Object.values(activeSessions));
  });

  // 5. Counselor sends manual message to student
  socket.on('counselor-message', ({ sessionId, text, counselorName }) => {
    const session = activeSessions[sessionId];
    if (!session) return;

    const counselorMsgObj = {
      id: Math.random().toString(36).substr(2, 9),
      sender: 'counselor',
      text,
      counselorName: counselorName || 'Guru BK',
      timestamp: new Date()
    };
    session.messages.push(counselorMsgObj);

    // Emit to student and other counselors
    io.to(`session:${sessionId}`).to('counselors').emit('counselor-new-message', {
      sessionId,
      message: counselorMsgObj
    });

    io.to('counselors').emit('counselor-sessions-update', Object.values(activeSessions));
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

server.listen(port, () => {
  console.log(`Express and Socket.io server running on port ${port}`);
});
