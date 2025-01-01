const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const Message = require("../models/chat");

mongoose.connect('mongodb://localhost:27017/chatApp');

app.set('view engine', 'ejs');
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.render('index');
});

app.get('/chat', async (req, res) => {
  const messages = await Message.find().sort({ timestamp: 1 });
  res.render('chat', { messages });
});

io.on('connection', (socket) => {
  console.log('New user connected');
  
  socket.on('sendMessage', async (data) => {
    const newMessage = new Message(data);
    await newMessage.save();
    io.emit('newMessage', data); // Broadcast to all users
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

server.listen(3000, () => console.log('Server running on port 3000'));
