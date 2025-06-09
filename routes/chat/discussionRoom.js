const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const GroupUser = require( '../../models/GroupUser' );
const Project = require( '../../models/Project' );
const Tasks = require( '../../models/Tasks' );
const File = require( '../../models/File' );
const Task = require( '../../models/Tasks' );
const Message = require( '../../models/Message' );
const Call = require( '../../models/Call' );

const router = express.Router();

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// File upload configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (req.session.userId) {
    next();
  } else {
    res.redirect('/login');
  }
};

//Routes
router.get('/', (req,res)=>{
  if(req.session.userId){
    res.redirect("/dashboard");
  }else{
    res.render('index');
  }
});

router.get("/community/:id/grouplogin", async(req,res)=>{
  const {id} = req.params;
  const community = await community.findById(id);
  console.log(community);
  res.render('grouplogin', {community});
});

router.post('/commumity/:id/grouplogin', async(req,res)=>{
  try{
    const {username,password} = req.body;
    const user = await GroupUser.findOne({username});
    
    if(user && await bcrypt.compare(password, user.password)){
      req.session.userId = user._id;
      await GroupUser.findByIdAndUpdate(user._id, {status: 'online'});
      res.redirect('/dashboard');
    }else{
      res.render('login', {error: 'Invalid credentials'});
    }
  }catch(error){
    res.render('login', {error: 'Login failed'});
  }
});

router.get("/community/:id/register", async(req,res)=>{
  try{
    const {username, email, password} = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new GroupUser({
      username,
      email,
      password: hashedPassword
    });

    await user.save();
    req.session.userId = user._id;
    res.redirect('/dashboard');
  }catch(error){
    res.render('register', {error: 'Registration failed'});
  }
});

router.get('/community/:id/dashboard', requireAuth, async(req,res)=>{
  try{
    const user = await GroupUser.findById(req.session.userId);
    const projects = await Project.find({
      $or: [
        { owner: req.session.userId},
        {member: req.session.userid}
      ]
    }).populate('owner members');
    res.render('dashboard', {user, projects});
  }catch(error){
    res.redirect('/login');
  }
});

router.get("/community/:id/project/:id", requireAuth, async(req,res)=>{
  try{
    const project = await Project.findById(req.params.id).populate('owner members');
    const tasks = await Tasks.find({project: req.params.id}).populate('assignedTo createdBy');
    const files = await File.find({project: req.params.id}).populate('uploadedBy');
    const user = await GroupUser.findById(req.session.userId);
    res.render('project', {project, tasks, files, user});
  }catch(err){
    res.redirect('/dashboard');
  }
});

router.post('/community/:id/project/create', requireAuth, async(req,res)=>{
  try{
    const {name, description} = req.body;
    const project = new Project({
      name,
      description,
      owner: req.session.userId,
      members: [req.session.userId]
    });
    await project.save();
    res.redirect("/dashboard");
  }catch(error){
    res.redirect('/dashboard');
  }
});

app.post('/community/:id/project/:id/invite', requireAuth, async(req,res)=>{
  try{
    const {username} = req.body;
    const user = await GroupUser.findOne({username});

    if(user){
      await Project.findByIdAndUpdate(req.params.id, {
        $addToSet: {members: user._id}
      });
    }
    res.redirect(`/project/${req.params.id}`);
  }catch(error){
    res.redirect(`/project/${req.params.id}`);
  }
});

router.post('/community/:id/task/create', requireAuth, async(req,res)=>{
  try{
    const {title, description, projectId, assignedTo, priority, dueDate} = req.body;
    const task = new Task({
      title,
      description,
      project: projectId,
      assignedTo: assignedTo || null,
      createBy: req.session.userId,
      priority,
      dueDate: dueDate || null
    });

    await task.save();
    res.redirect(`project/${projectId}`);
  }catch(error){
    res.redirect('/dashboard');
  }
});

router.post('/community/:id/task/:id/update', requireAuth, async(req,res)=>{
  try{
    const { status } = req.body;
    const task = await Task.findByIdAndUpdate(req.params.id, {status});
    res.redirect(`/project/${task.project}`);
  }catch(error){
    res.redirect('/dashboard');
  }
});

router.post('/upload/:projectId', requireAuth, upload.single('file'), async(req,res)=>{
  try{
    if(req.file){
      const file = new File({
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        uploadedBy: req.session.userId,
        project: req.params.projectId
      });

      await file.save();

      //Emit file upload event
      io.to(`project-${req.params.projectId}`).emit('fileUploaded',{
        file: await file.populate('uploadedBy')
      });
    }

    res.redirect(`/project/${req.params.projectId}`);
  }catch(error){
    res.redirect(`/project/${req.params.projectId}`);
  }
});

app.get('/call/:roomId', requireAuth, async(req,res)=>{
  try{
    const user = await GroupUser.findById(req.session.userId);
    res.render('call', {roomId: req.params.roomId, user});
  }catch(error){
    res.redirect('/dashboard');
  }
});

router.post('/logout', (req,res)=>{
  req.session.destroy();
  res.redirect('/');
});

//Socket.IO handling
const connectedUsers = new Map();

io.on('connection', (socket)=>{
  console.log('User connected:', socket.id);

  socket.on('userConnected', async(userId)=>{
    connectedUsers.set(socket.id, userId);
    await GroupUser.findByIdAndUpdate(userId, {status: 'online'});

    //Join user to their project rooms
    const projects = await Project.find({
      $or: [{ owner: userId }, { members: userId }]
    });

    projects.forEach(project => {
      socket.join(`project-${project._id}`);
    });

    // Broadcast user online status
    socket.broadcast.emit('userStatusChanged', { userId, status: 'online'});
  });
  
  socket.on('joinRoom', (room)=>{
    socket.join(room);
  });

  socket.on('sendMessage', async (data) => {
    try{
      const message = new Message({
        content: data.content,
        sender: data.senderId,
        room: data.room,
        type: data.type || 'text'
      });

      await message.save();
      const populatedMessage = await Message.findById(message._id).populate('sender');

      io.to(data.room).emit('newMessage', populatedMessage);
    }catch(error){
      console.log('Error sending message:', error);
    }
  });

  //video call signaling
  socket.on('offer', (data)=>{
    socket.to(data.room).emit('offer', data);
  });

  socket.on('answer', (data)=>{
    socket.to(data.room).emit('answer', data);
  });
  
  socket.on('ice-candidate', (data)=>{
    socket.to(data.room).emit('ice-candidate', data);
  });

  socket.on('join-call', async(data)=>{
    const { roomId, userId } = data;
    socket.join(roomId);

    //Update or create call record
    let call = await Call.findOne({ roomId, status: 'active' });
    if(!call){
      call = new Call({roomId, participants: [userId]});
    }else{
      call.participants.addToSet(userId);
    }
    await call.save();

    socket.to(roomId).emit('user-joined', {userId, socketId: socket.id});
  });

  socket.on('leave-call', async(data)=>{
    const { roomId, userId } = data;
    socket.leave(roomId);
    socket.to(roomId).emit('user-left', {userId, socketId: socket.id});
  });

  socket.on('typing', (data)=>{
    socket.io(data.room).emit('userTyping', {
      userId: data.userId,
      username: data.username
    });
  });

  socket.on('stopTyping', (data)=>{
    socket.to(data.room).emit('userStoppedTyping', {
      userId: data.userId
    });
  });

  socket.on('disconnect', async()=>{
    const userId = connectedUsers.get(socket.id);
    if(userId){
      await GroupUser.findByIdAndUpdate(userId, {
        status: 'offline',
        lastSeen: new Date()
      });

      socket.broadcast.emit('userStatusChanged', {userId, status: 'offline'});
      connectedUsers.delete(socket.id);
    }
    console.log('user disconnected:', socket.id);
  });
});

module.exports = router;