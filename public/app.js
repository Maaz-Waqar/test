let socket;
let currentUsername = '';
let interests = [];

const adjectives = ['Happy', 'Brave', 'Swift', 'Calm', 'Bold', 'Wise', 'Fierce', 'Kind', 'Wild', 'Free', 'Cool', 'Lost', 'Hidden', 'Silent', 'Bright', 'Dark', 'Lucky', 'Epic', 'Mystic', 'Noble'];
const nouns = ['Tiger', 'Eagle', 'Wolf', 'Lion', 'Bear', 'Hawk', 'Fox', 'Dragon', 'Phoenix', 'Raven', 'Storm', 'Shadow', 'Thunder', 'Ocean', 'Mountain', 'River', 'Moon', 'Star', 'Sun', 'Wind'];

function generateUsername() {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adj}${noun}`;
}

function confirmAge() {
  currentUsername = generateUsername();
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
  
  document.getElementById('username-screen').classList.add('hidden');
  document.getElementById('chat-screen').classList.remove('hidden');
  
  connectToServer();
}

function connectToServer() {
  socket = io();
  
  socket.on('connect', () => {
    socket.emit('find-partner', currentUsername);
  });
  
  socket.on('waiting', () => {
    updateStatus('Looking for someone...');
    showWaitingArea();
  });
  
  socket.on('chat-start', (data) => {
    updateStatus('You are matched randomly');
    hideWaitingArea();
    enableChat();
  });
  
  socket.on('receive-message', (data) => {
    if (data.sender !== currentUsername) {
      addMessage(data.message, 'partner', data.sender);
    }
  });
  
  socket.on('partner-left', () => {
    addSystemMessage('Partner disconnected');
    disableChat();
    updateStatus('Partner left. Click Skip to find another.');
  });
  
  socket.on('skipped', () => {
    clearMessages();
    showWaitingArea();
    socket.emit('find-partner', currentUsername);
  });
}

function sendMessage() {
  const input = document.getElementById('message-input');
  const message = input.value.trim();
  
  if (message && socket) {
    socket.emit('send-message', message);
    addMessage(message, 'own', 'You');
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
    input.value = '';
  }
}

function removeInterest(index) {
  interests.splice(index, 1);
  renderInterests();
  renderCurrentInterests();
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