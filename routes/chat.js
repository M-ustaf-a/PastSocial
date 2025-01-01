const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chat");
const Message = require("../models/chat");

// Chat Routes for specific community
router.get("/community/:communityId/chat", chatController.chat);
router.post("/community/:communityId/chat", chatController.createMessage);

// Socket.IO Setup
const initializeSocket = (server) => {
    const socketIo = require("socket.io");
    const io = socketIo(server);

    // Active users tracking
    const activeUsers = new Map(); // { communityId: { userId: { username, lastActiveTimestamp } } }
    const ACTIVE_TIMEOUT = 5 * 60 * 1000; // 5 minutes inactivity timeout

    // Helper function to clean up inactive users
    const cleanupInactiveUsers = () => {
        const now = Date.now();
        activeUsers.forEach((users, communityId) => {
            for (const [userId, userData] of users.entries()) {
                if (now - userData.lastActiveTimestamp > ACTIVE_TIMEOUT) {
                    users.delete(userId);
                }
            }
            
            // Broadcast updated active users list
            io.to(communityId).emit('activeUsersList', 
                Array.from(users.values()).map(user => user.username)
            );
        });
    };

    // Run cleanup every 2 minutes
    const cleanupInterval = setInterval(cleanupInactiveUsers, 2 * 60 * 1000);

    io.on("connection", (socket) => {
        console.log("New user connected");

        // User activity tracking
        socket.on("userActive", (data) => {
            const { username, communityId, userId } = data;
            
            // Initialize community users if not exists
            if (!activeUsers.has(communityId)) {
                activeUsers.set(communityId, new Map());
            }

            // Update or add user to active users
            const communityUsers = activeUsers.get(communityId);
            communityUsers.set(userId, {
                username,
                lastActiveTimestamp: Date.now()
            });

            // Broadcast updated active users list
            io.to(communityId).emit('activeUsersList', 
                Array.from(communityUsers.values()).map(user => user.username)
            );
        });

        // Sending a message
        socket.on("sendMessage", async (data) => {
            try {
                const { username, message, communityId, userId } = data;

                // Create and save message
                const newMessage = new Message({
                    username: username,
                    message: message,
                    community: communityId
                });
                await newMessage.save();
                
                // Update user activity
                if (activeUsers.has(communityId)) {
                    const communityUsers = activeUsers.get(communityId);
                    if (communityUsers.has(userId)) {
                        communityUsers.get(userId).lastActiveTimestamp = Date.now();
                    }
                }
                
                // Broadcast message to community
                io.to(communityId).emit("newMessage", { 
                    username, 
                    message,
                    timestamp: new Date()
                });
            } catch (error) {
                console.error("Error saving message:", error);
            }
        });

        // Join a community-specific room
        socket.on("joinCommunity", (communityId) => {
            socket.join(communityId);
        });

        // Handle disconnection
        socket.on("disconnect", () => {
            // Remove user from active users in all communities
            activeUsers.forEach((users, communityId) => {
                for (const [userId, userData] of users.entries()) {
                    users.delete(userId);
                }
                
                // Broadcast updated active users list
                io.to(communityId).emit('activeUsersList', 
                    Array.from(users.values()).map(user => user.username)
                );
            });

            console.log("User disconnected");
        });
    });

    // Cleanup interval should be cleared when server closes
    server.on('close', () => {
        clearInterval(cleanupInterval);
    });

    return io;
};

module.exports = { router, initializeSocket };