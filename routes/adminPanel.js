const express = require("express");
const router = express.Router();
const Community = require("../models/community");
const AdminPortal = require("../models/adminPortal");
const bcrypt = require("bcryptjs");
const ApprovalCommunity = require("../models/approveCommunity");
const { isAdminLogged } = require("../middleware");

// GET: Admin login panel
router.get("/adminLoginPanel/713af207-d906-4d49-85cb-dddbde483a59/:communityId", (req, res) => {
    try {
        const { communityId } = req.params;
        res.render("admin/adminLoginPanel", { communityId });
    } catch (error) {
        console.error("Error in admin login page:", error);
        res.status(500).send("Internal Server Error");
    }
});

// POST: Admin login logic
router.post("/adminLoginPanel/713af207-d906-4d49-85cb-dddbde483a59/:communityId", async (req, res) => {
    try {
        const { email, password } = req.body;
        const { communityId } = req.params;

        if (!email || !password || !communityId) {
            return res.status(400).send("All fields are required");
        }

        const [community, admin] = await Promise.all([
            Community.findById(communityId),
            AdminPortal.findOne({ email, communityId }),
        ]);

        if (!community) return res.status(404).send("Community not found");
        if (!admin) return res.status(401).send("Invalid credentials");

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) return res.status(401).send("Invalid credentials");

        req.session.adminId = admin._id;
        req.session.communityId = communityId;

        res.redirect(`/adminPanel/713af207-d906-4d49-85cb-dddbde483a59/${communityId}`);
    } catch (error) {
        console.error("Error in admin login:", error);
        res.status(500).send("Internal Server Error");
    }
});

// GET: Admin panel
router.get("/adminPanel/713af207-d906-4d49-85cb-dddbde483a59/:communityId", isAdminLogged, async (req, res) => {
    try {
        const { communityId } = req.params;

        if (req.session.communityId !== communityId) {
            return res.status(403).send("Unauthorized access");
        }

        const [community, users] = await Promise.all([
            Community.findById(communityId),
            ApprovalCommunity.find({ communityId }),
        ]);

        if (!community) {
            return res.status(404).send("Community not found");
        }

        res.render("admin/adminPanel", { users, community, communityId });
    } catch (error) {
        console.error("Error in admin panel:", error);
        res.status(500).send("Internal Server Error");
    }
});

// GET: Admin logout
router.get("/adminLogoutPanel/713af207-d906-4d49-85cb-dddbde483a59/:communityId", isAdminLogged, (req, res) => {
    const { communityId } = req.params;

    req.session.destroy((err) => {
        if (err) {
            console.error("Error during logout:", err);
            return res.redirect(`/adminPanel/713af207-d906-4d49-85cb-dddbde483a59/${communityId}`);
        }
        res.clearCookie("connect.sid");
        res.redirect(`/adminLoginPanel/713af207-d906-4d49-85cb-dddbde483a59/${communityId}`);
    });
});

module.exports = router;
