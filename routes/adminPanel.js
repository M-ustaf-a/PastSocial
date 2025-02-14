const express = require("express");
const router = express.Router();
const Community = require("../models/community");
const AdminPortal = require( "../models/adminPortal" );
const bcrypt = require("bcryptjs");

router.get("/adminLoginPanel/713af207-d906-4d49-85cb-dddbde483a59/:communityId", (req,res)=>{
    const {communityId} = req.params;
    res.render("admin/adminLoginPanel", {communityId});
});

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

        // Successful login response
        res.status(200).json({ message: "Login successful", admin });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});


router.get("/adminPanel/713af207-d906-4d49-85cb-dddbde483a59/:communityId", async(req,res)=>{
    res.render("admin/adminPanel.ejs");
});

router.post("/adminPanel/713af207-d906-4d49-85cb-dddbde483a59/:communityId", async(req,res)=>{
    const {email, password, communityId} = req.body.adminPortal;
    const community = await Community.find(email,communityId);
    console.log(community);
});

module.exports = router;