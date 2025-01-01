const Message = require("../models/chat");
const Community = require("../models/community");

module.exports.chat = async (req, res) => {
    try {
        const { communityId } = req.params;
        
        // Verify community exists
        const community = await Community.findById(communityId);
        if (!community) {
            return res.status(404).send("Community not found");
        }

        // Fetch messages for this specific community
        const messages = await Message.find({ community: communityId }).sort({ timestamp: 1 });
        const currentUsername = req.session.user?.username || "Guest";

        res.render("chat", { 
            messages, 
            community,
            currentUsername
        });
    } catch (error) {
        console.error("Error fetching messages:", error);
        res.status(500).send("An error occurred while fetching chat messages");
    }
};

module.exports.createMessage = async (req, res) => {
    try {
        const { communityId } = req.params;
        const { username, message } = req.body;

        const newMessage = new Message({
            username,
            message,
            community: communityId
        });

        await newMessage.save();
        
        req.flash('success', 'Message sent successfully!');
        res.redirect(`/community/${communityId}/chat`);
    } catch (error) {
        console.error("Error creating message:", error);
        req.flash('error', 'Failed to send message');
        res.redirect(`/community/${communityId}/chat`);
    }
};