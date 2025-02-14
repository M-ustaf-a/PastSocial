const express = require("express");
const router = express.Router();
const Community = require("../models/community");
const AdminPortal = require( "../models/adminPortal" );


router.get("/adminLoginPanel/713af207-d906-4d49-85cb-dddbde483a59/:communityId", (req,res)=>{
    res.render("admin/adminLoginPanel");
});

router.post("/adminLoginPanel/713af207-d906-4d49-85cb-dddbde483a59/:communityId", async(req,res)=>{
    const {email,password,communityId} = req.body.loginPanel;
    const admin = await AdminPortal.find(email,communityId);
    console.log(admin);
})

router.get("/adminPanel/713af207-d906-4d49-85cb-dddbde483a59/:communityId", async(req,res)=>{
    res.render("admin/adminPanel.ejs");
});

router.post("/adminPanel/713af207-d906-4d49-85cb-dddbde483a59/:communityId", async(req,res)=>{
    const {email, password, communityId} = req.body.adminPortal;
    const community = await Community.find(email,communityId);
    console.log(community);
});

module.exports = router;