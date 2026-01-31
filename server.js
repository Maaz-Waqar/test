const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.static(path.join(__dirname, 'public')));

let waitingUsers = [];
let activeChats = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('find-partner', (data) => {
    socket.username = data.username || 'Stranger';
    socket.interests = data.interests || [];
    
    // Filter out the user themselves from waiting list
    waitingUsers = waitingUsers.filter(user => user.id !== socket.id);
    
    if (waitingUsers.length > 0) {
      const partner = waitingUsers.shift();
      
      // Don't match with yourself
      if (partner.id === socket.id) {
        socket.emit('waiting');
        return;
      }
      
      const roomId = `${socket.id}-${partner.id}`;
      socket.join(roomId);
      partner.join(roomId);
      
      activeChats.set(socket.id, { partnerId: partner.id, roomId });
      activeChats.set(partner.id, { partnerId: socket.id, roomId });
      
      // Find mutual interests
      const mutualInterests = socket.interests.filter(interest => 
        partner.interests && partner.interests.includes(interest)
      );
      
      socket.emit('chat-start', { 
        partnerName: partner.username,
        mutualInterests: mutualInterests 
      });
      partner.emit('chat-start', { 
        partnerName: socket.username,
        mutualInterests: mutualInterests 
      });
    } else {
      waitingUsers.push(socket);
      socket.emit('waiting');
    }
  });

  socket.on('send-message', (message) => {
    const chatInfo = activeChats.get(socket.id);
    if (chatInfo) {
      io.to(chatInfo.roomId).emit('receive-message', {
        message,
        sender: socket.username,
        isOwn: false
      });
    }
  });

  socket.on('user-away', () => {
    const chatInfo = activeChats.get(socket.id);
    if (chatInfo) {
      const partner = io.sockets.sockets.get(chatInfo.partnerId);
      if (partner) {
        partner.emit('partner-away');
      }
    }
  });

  socket.on('user-back', () => {
    const chatInfo = activeChats.get(socket.id);
    if (chatInfo) {
      const partner = io.sockets.sockets.get(chatInfo.partnerId);
      if (partner) {
        partner.emit('partner-back');
      }
    }
  });

  socket.on('skip', () => {
    handleDisconnect(socket);
    socket.emit('skipped');
  });

  socket.on('disconnect', () => {
    handleDisconnect(socket);
  });
});

function handleDisconnect(socket) {
  const chatInfo = activeChats.get(socket.id);
  
  if (chatInfo) {
    const partner = io.sockets.sockets.get(chatInfo.partnerId);
    if (partner) {
      partner.leave(chatInfo.roomId);
      partner.emit('partner-left');
      activeChats.delete(chatInfo.partnerId);
    }
    socket.leave(chatInfo.roomId);
    activeChats.delete(socket.id);
  }
  
  waitingUsers = waitingUsers.filter(user => user.id !== socket.id);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});