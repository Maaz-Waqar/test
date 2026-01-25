let socket;
let currentUsername = '';
let interests = [];
let guestId = '';
let chatHistory = [];
let currentChatMessages = [];
let currentPartner = '';
let isReconnecting = false;

const adjectives = ['Happy', 'Brave', 'Swift', 'Calm', 'Bold', 'Wise', 'Fierce', 'Kind', 'Wild', 'Free', 'Cool', 'Lost', 'Hidden', 'Silent', 'Bright', 'Dark', 'Lucky', 'Epic', 'Mystic', 'Noble'];
const nouns = ['Tiger', 'Eagle', 'Wolf', 'Lion', 'Bear', 'Hawk', 'Fox', 'Dragon', 'Phoenix', 'Raven', 'Storm', 'Shadow', 'Thunder', 'Ocean', 'Mountain', 'River', 'Moon', 'Star', 'Sun', 'Wind'];

function generateUsername() {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adj}${noun}`;
}

function generateGuestId() {
  return 'guest_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

function loadGuestSession() {
  const session = localStorage.getItem('guestSession');
  if (session) {
    const data = JSON.parse(session);
    guestId = data.guestId;
    currentUsername = data.username;
    interests = data.interests || [];
    chatHistory = data.chatHistory || [];
    return true;
  }
  return false;
}

function saveGuestSession() {
  const session = {
    guestId: guestId,
    username: currentUsername,
    interests: interests,
    chatHistory: chatHistory
  };
  localStorage.setItem('guestSession', JSON.stringify(session));
}

function addToChatHistory(partnerName) {
  const timestamp = new Date().toLocaleString();
  const chatId = Date.now().toString();
  
  const chatRecord = {
    id: chatId,
    partner: partnerName,
    time: timestamp,
    messages: [...currentChatMessages]
  };
  
  chatHistory.unshift(chatRecord);
  if (chatHistory.length > 5) {
    chatHistory = chatHistory.slice(0, 5);
  }
  saveGuestSession();
}

function saveChatMessage(text, sender, type) {
  currentChatMessages.push({
    text: text,
    sender: sender,
    type: type,
    timestamp: new Date().toLocaleString()
  });
}

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // User switched tab or minimized
    if (socket && socket.connected && currentPartner) {
      socket.emit('user-away');
    }
  } else {
    // User came back
    if (socket && socket.connected && currentPartner) {
      socket.emit('user-back');
    } else if (!socket || !socket.connected) {
      // Reconnect if disconnected
      attemptReconnect();
    }
  }
});

// Handle before unload (closing tab/refresh)
window.addEventListener('beforeunload', () => {
  if (socket && currentPartner) {
    socket.emit('user-away');
  }
});

// Check for existing session on load
window.addEventListener('DOMContentLoaded', () => {
  if (loadGuestSession()) {
    // Skip age gate and username screen, go straight to chat
    document.getElementById('age-gate').classList.add('hidden');
    document.getElementById('username-screen').classList.add('hidden');
    document.getElementById('chat-screen').classList.remove('hidden');
    renderInterests();
    connectToServer();
  }
});

function confirmAge() {
  // Generate new guest session only if doesn't exist
  if (!guestId) {
    guestId = generateGuestId();
    currentUsername = generateUsername();
  }
  document.getElementById('username-input').value = currentUsername;
  document.getElementById('age-gate').classList.add('hidden');
  document.getElementById('username-screen').classList.remove('hidden');
}

function rejectAge() {
  document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-size:24px;color:#6b7280;background:#0a1628;">You must be 18+ to use this service.</div>';
}

function startChat() {
  const usernameInput = document.getElementById('username-input').value.trim();
  currentUsername = usernameInput || currentUsername;
  
  saveGuestSession();
  
  document.getElementById('username-screen').classList.add('hidden');
  document.getElementById('chat-screen').classList.remove('hidden');
  
  renderInterests();
  connectToServer();
}

function connectToServer() {
  socket = io();
  
  socket.on('connect', () => {
    console.log('Connected to server');
    isReconnecting = false;
    socket.emit('find-partner', currentUsername);
  });
  
  socket.on('disconnect', () => {
    console.log('Disconnected from server');
    addSystemMessage('Connection lost. Reconnecting...');
    attemptReconnect();
  });
  
  socket.on('waiting', () => {
    updateStatus('Looking for someone...');
    showWaitingArea();
  });
  
  socket.on('chat-start', (data) => {
    currentPartner = data.partnerName;
    currentChatMessages = [];
    updateStatus('You are matched randomly');
    hideWaitingArea();
    enableChat();
  });
  
  socket.on('receive-message', (data) => {
    if (data.sender !== currentUsername) {
      addMessage(data.message, 'partner', data.sender);
      saveChatMessage(data.message, data.sender, 'partner');
    }
  });
  
  socket.on('partner-left', () => {
    addSystemMessage('Partner disconnected');
    if (currentPartner && currentChatMessages.length > 0) {
      addToChatHistory(currentPartner);
    }
    currentPartner = '';
    currentChatMessages = [];
    disableChat();
    updateStatus('Partner left. Click Skip to find another.');
  });
  
  socket.on('partner-away', () => {
    addSystemMessage('Partner went offline (switched tab or lost connection)');
  });
  
  socket.on('partner-back', () => {
    addSystemMessage('Partner is back online');
  });
  
  socket.on('skipped', () => {
    if (currentPartner && currentChatMessages.length > 0) {
      addToChatHistory(currentPartner);
    }
    currentPartner = '';
    currentChatMessages = [];
    clearMessages();
    showWaitingArea();
    socket.emit('find-partner', currentUsername);
  });
}

function attemptReconnect() {
  if (isReconnecting) return;
  isReconnecting = true;
  
  setTimeout(() => {
    if (!socket || !socket.connected) {
      addSystemMessage('Attempting to reconnect...');
      connectToServer();
    }
  }, 2000);
}

function sendMessage() {
  const input = document.getElementById('message-input');
  const message = input.value.trim();
  
  if (message && socket) {
    socket.emit('send-message', message);
    addMessage(message, 'own', 'You');
    saveChatMessage(message, currentUsername, 'own');
    input.value = '';
  }
}

function skipPartner() {
  if (socket) {
    socket.emit('skip');
    disableChat();
    updateStatus('Looking for someone...');
  }
}

function addInterest() {
  const input = document.getElementById('interest-input');
  const interest = input.value.trim();
  
  if (interest && interests.length < 5) {
    interests.push(interest);
    renderInterests();
    renderCurrentInterests();
    saveGuestSession();
    input.value = '';
  }
}

function removeInterest(index) {
  interests.splice(index, 1);
  renderInterests();
  renderCurrentInterests();
  saveGuestSession();
}

function renderInterests() {
  const container = document.getElementById('interest-tags');
  container.innerHTML = '';
  
  interests.forEach((interest, index) => {
    const tag = document.createElement('div');
    tag.className = 'interest-tag';
    tag.innerHTML = `
      ${interest}
      <span class="remove" onclick="removeInterest(${index})">×</span>
    `;
    container.appendChild(tag);
  });
}

function renderCurrentInterests() {
  const container = document.getElementById('current-interests');
  container.innerHTML = '';
  
  interests.forEach((interest, index) => {
    const tag = document.createElement('div');
    tag.className = 'interest-tag';
    tag.innerHTML = `
      ${interest}
      <span class="remove" onclick="removeInterest(${index})">×</span>
    `;
    container.appendChild(tag);
  });
}

function openInterestPopup() {
  renderCurrentInterests();
  document.getElementById('interest-popup').classList.remove('hidden');
}

function closeInterestPopup() {
  document.getElementById('interest-popup').classList.add('hidden');
}

function logout() {
  if (confirm('Are you sure you want to logout? Your guest session will be cleared.')) {
    localStorage.removeItem('guestSession');
    location.reload();
  }
}

function showChatHistory() {
  const menuItems = document.querySelector('.menu-items');
  const historyList = document.getElementById('history-list');
  
  // Hide main menu
  menuItems.style.display = 'none';
  
  // Show history
  historyList.innerHTML = '<button onclick="backToMenu()" class="back-btn">← Go Back</button>';
  historyList.innerHTML += '<h4 style="color: #ff5068; margin: 20px 0 15px 0;">Recent Chats</h4>';
  
  if (chatHistory.length === 0) {
    historyList.innerHTML += '<p style="color: #6b7280; font-size: 14px;">No chat history yet</p>';
  } else {
    chatHistory.forEach(chat => {
      const item = document.createElement('div');
      item.className = 'history-item';
      item.onclick = () => viewChat(chat);
      item.innerHTML = `
        <div class="partner">${chat.partner}</div>
        <div class="time">${chat.time}</div>
        <div style="color: #6b7280; font-size: 12px; margin-top: 5px;">${chat.messages.length} messages</div>
      `;
      historyList.appendChild(item);
    });
  }
  
  historyList.classList.remove('hidden');
}

function viewChat(chat) {
  const historyList = document.getElementById('history-list');
  
  historyList.innerHTML = '<button onclick="showChatHistory()" class="back-btn">← Back to History</button>';
  historyList.innerHTML += `<h4 style="color: #ff5068; margin: 20px 0 15px 0;">Chat with ${chat.partner}</h4>`;
  historyList.innerHTML += `<p style="color: #6b7280; font-size: 12px; margin-bottom: 15px;">${chat.time}</p>`;
  
  const messagesContainer = document.createElement('div');
  messagesContainer.style.cssText = 'max-height: 400px; overflow-y: auto; background: #0f1d33; padding: 15px; border-radius: 6px;';
  
  chat.messages.forEach(msg => {
    const msgEl = document.createElement('div');
    msgEl.style.cssText = `margin-bottom: 12px; ${msg.type === 'own' ? 'text-align: right;' : 'text-align: left;'}`;
    msgEl.innerHTML = `
      <div style="font-size: 11px; color: #6b7280; margin-bottom: 3px;">${msg.sender}</div>
      <div style="display: inline-block; padding: 8px 12px; border-radius: 6px; background: ${msg.type === 'own' ? '#ff5068' : '#1a2942'}; color: white; max-width: 80%;">
        ${msg.text}
      </div>
    `;
    messagesContainer.appendChild(msgEl);
  });
  
  historyList.appendChild(messagesContainer);
}

function backToMenu() {
  const menuItems = document.querySelector('.menu-items');
  const historyList = document.getElementById('history-list');
  
  menuItems.style.display = 'flex';
  historyList.classList.add('hidden');
}

function toggleMenu() {
  document.getElementById('sidebar').classList.toggle('open');
}

function closeMenu() {
  document.getElementById('sidebar').classList.remove('open');
}

function showWaitingArea() {
  document.getElementById('waiting-message').style.display = 'flex';
  document.getElementById('messages').classList.remove('active');
}

function hideWaitingArea() {
  document.getElementById('waiting-message').style.display = 'none';
  document.getElementById('messages').classList.add('active');
}

function addMessage(text, type, sender) {
  const messagesDiv = document.getElementById('messages');
  const messageEl = document.createElement('div');
  messageEl.className = `message ${type}`;
  
  const senderEl = document.createElement('div');
  senderEl.className = 'sender';
  senderEl.textContent = sender;
  
  const textEl = document.createElement('div');
  textEl.className = 'text';
  textEl.textContent = text;
  
  messageEl.appendChild(senderEl);
  messageEl.appendChild(textEl);
  messagesDiv.appendChild(messageEl);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function addSystemMessage(text) {
  const messagesDiv = document.getElementById('messages');
  const messageEl = document.createElement('div');
  messageEl.className = 'system-message';
  messageEl.textContent = text;
  messagesDiv.appendChild(messageEl);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function clearMessages() {
  document.getElementById('messages').innerHTML = '';
}

function updateStatus(text) {
  document.getElementById('status').textContent = text;
}

function enableChat() {
  document.getElementById('message-input').disabled = false;
  document.getElementById('send-btn').disabled = false;
  document.getElementById('message-input').focus();
}

function disableChat() {
  document.getElementById('message-input').disabled = true;
  document.getElementById('send-btn').disabled = true;
}

document.getElementById('message-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendMessage();
  }
});

document.getElementById('interest-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    addInterest();
  }
});