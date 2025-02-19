const express = require("express");
const router = express.Router();
const Community = require("../models/community");
const AdminPortal = require("../models/adminPortal");
const bcrypt = require("bcryptjs");
const ApprovalCommunity = require("../models/approveCommunity");
const { isAdminLogged } = require("../middleware");

// Get route Admin login panel
router.get("/adminLoginPanel/713af207-d906-4d49-85cb-dddbde483a59/:communityId", (req, res) => {
    try {
        const  {communityId}  = req.params;
        console.log(communityId);
        res.render("admin/adminLoginPanel", { communityId });
    } catch (error) {
        console.error("Error in admin login page:", error);
        res.status(500).send("Internal Server Error");
    }
});

// Post route Admin LogIn panel
router.post("/adminLoginPanel/713af207-d906-4d49-85cb-dddbde483a59/:communityId", async (req, res) => {
    try {
        const { email, password } = req.body;
        const  { communityId }  = req.params;
        console.log(communityId);
        // Validate inputs
        if (!email || !password || !communityId) {
            return res.status(400).send("All fields are required");
        }

        // Find admin and verify community exists
        const [community, admin] = await Promise.all([
            Community.findById(communityId),
            AdminPortal.findOne({ email, communityId })
        ]);
        console.log(community,admin);

        if (!community) {
            return res.status(404).send("Community not found");
        }

        if (!admin) {
            return res.status(401).send("Invalid credentials");
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(401).send("Invalid credentials");
        }

        console.log(isMatch);
        // Set session
        req.session.adminId = admin._id;
        req.session.communityId = communityId;

        res.redirect(`/adminPanel/713af207-d906-4d49-85cb-dddbde483a59/${communityId}`);
    } catch (error) {
        console.error("Error in admin login:", error);
        res.status(500).send("Internal Server Error");
    }
});

// Get route Admin panel
router.get("/adminPanel/713af207-d906-4d49-85cb-dddbde483a59/:communityId",isAdminLogged, async (req, res) => {
    try {
        const { communityId } = req.params;

        // Verify admin has access to this community
        if (req.session.communityId !== communityId) {
            return res.status(403).send("Unauthorized access");
        }

        const [community, users] = await Promise.all([
            Community.findById(communityId),
            ApprovalCommunity.find({ communityId })
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

// Post route Admin panel
// router.post("/adminPanel/713af207-d906-4d49-85cb-dddbde483a59/:communityId", isAdminLogged, async (req, res) => {
//     try {
//         const { email, password } = req.body.adminPortal;
//         const { communityId } = req.params;

//         // Verify admin has access to this community
//         if (req.session.communityId !== communityId) {
//             return res.status(403).send("Unauthorized access");
//         }

//         const community = await Community.findOne({ email, _id: communityId });
//         if (!community) {
//             return res.status(404).send("Community not found");
//         }

//         // Add your admin panel post logic here
//         res.redirect(`/adminPanel/713af207-d906-4d49-85cb-dddbde483a59/${communityId}`);
//     } catch (error) {
//         console.error("Error in admin panel post:", error);
//         res.status(500).send("Internal Server Error");
//     }
// });

// Admin logout panel
router.get("/adminLogoutPanel/713af207-d906-4d49-85cb-dddbde483a59/:communityId", isAdminLogged, async (req, res) => {
    try {
        const { communityId } = req.params;
        console.log(communityId);
        req.session.destroy((err) => {
            if (err) {
                console.error("Error during logout:", err);
                return res.redirect(`/adminPanel/713af207-d906-4d49-85cb-dddbde483a59/${communityId}`);
            }
            res.clearCookie("connect.sid");
            res.redirect(`/adminLoginPanel/713af207-d906-4d49-85cb-dddbde483a59/${communityId}`);
        });
    } catch (error) {
        console.error("Error in logout:", error);
        res.status(500).send("Internal Server Error");
    }
});

module.exports = router;