const socket = io();

const form = document.getElementById('chat-form');
const messageInput = document.getElementById('message');
const usernameInput = document.getElementById('username');
const messagesList = document.getElementById('messages');

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const message = {
    username: usernameInput.value.trim(),
    message: messageInput.value.trim(),
  };
  socket.emit('sendMessage', message);
  messageInput.value = '';
});

socket.on('newMessage', (data) => {
  const li = document.createElement('li');
  li.innerHTML = `<strong>${data.username}:</strong> ${data.message}`;
  messagesList.appendChild(li);
});
