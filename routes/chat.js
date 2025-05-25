const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const session = require('express-session');
const MongoStore = require("connect-mongo");
const passport = require("passport");
const path = require("path");
const socketio = require("socket.io");
const http = require("http");
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketio(server);



