const express = require("express");
const router = express.Router();
const Community = require("../models/community");
const AdminPortal = require( "../models/adminPortal" );
const bcrypt = require("bcryptjs");
const ApprovalCommunity = require( "../models/approveCommunity" );

router.get("/adminLoginPanel/713af207-d906-4d49-85cb-dddbde483a59/:communityId", (req,res)=>{
    const {communityId} = req.params;
    res.render("admin/adminLoginPanel", {communityId});
});

//Admin LogIn panel
router.post("/adminLoginPanel/713af207-d906-4d49-85cb-dddbde483a59/:communityId", async (req, res) => {
    try {
        const { email, password } = req.body.loginPanel; // Assuming the request body is { email, password }
        const { communityId } = req.params; // Extracting communityId from the route parameter

        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required." });
        }

        // Find the admin by email and communityId
        const admin = await AdminPortal.findOne({ email, communityId });
        if (!admin) {
            return res.status(404).json({ error: "Admin not found." });
        }
        console.log(admin);

        // Compare passwords using bcrypt
        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(401).json({ error: "Invalid credentials." });
        }
        req.session.adminPanelId = admin._id;
        // Successful login response
        res.redirect(`/adminPanel/713af207-d906-4d49-85cb-dddbde483a59/${communityId}`);
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});


//Admin logout panel
router.get("/adminLogoutPanel/713af207-d906-4d49-85cb-dddbde483a59/:communityId", async(req,res)=>{
    const {communityId} = req.params;
    req.session.destroy((err)=>{
        if(err){
            console.error("Error during logout",err);
            res.redirect(`/adminPanel/713af207-d906-4d49-85cb-dddbde483a59/${communityId}`)
        }
        res.clearCookie("connect.sid");
        res.redirect(`/adminLoginPanel/713af207-d906-4d49-85cb-dddbde483a59/${communityId}`)
    })
})


router.get("/adminPanel/713af207-d906-4d49-85cb-dddbde483a59/:communityId", async(req,res)=>{
    const {communityId} = req.params;
    const community = await Community.findById(communityId);
    const users = await ApprovalCommunity.find({communityId});
    console.log(users);
    res.render("admin/adminPanel.ejs", {users, community});
});

router.post("/adminPanel/713af207-d906-4d49-85cb-dddbde483a59/:communityId", async(req,res)=>{
    const {email, password, communityId} = req.body.adminPortal;
    const community = await Community.find(email,communityId);
    console.log(community);
});

module.exports = router;