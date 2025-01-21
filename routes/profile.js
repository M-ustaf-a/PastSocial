const express = require("express");
const Community = require( "../models/community" );
const User = require( "../models/user" );
const CommunityUser = require( "../models/communityUser" );
const router = express.Router();


const isAuthenticated = (req,res,next)=>{
    if(req.session.userId){
      return next();
    }
    res.redirect("/admin/login");
};

router.get("/community/adminProfile",isAuthenticated, async(req,res)=>{
  try{
    const userid = req.session.userId;
    const user = await User.findById(userid);
    if(!user){
      return res.status(404).send('user not found');
    }
    const communities = await Community.find({});
    res.render("profile.ejs", {communities,user});
  }catch(err){
    console.log(err);
  }
});

// api for show community in admin profile

router.get("/api/community/communities", async(req,res)=>{
  try{
    const userid = req.session.userId;
    const communities = await Community.find({});
    res.json(communities);
  }catch(err){
    console.log(err);
  }
})

//show the community user profile
router.get("/community/:communityId/link/:userId/showProfile", async(req,res)=>{
  const {communityId, userId} = req.params;
  const community = await Community.findById(communityId);
  console.log(community);
  const user = await CommunityUser.findById(userId);
  console.log(user);
  res.render("communityUserProfile.ejs", {community,user})
})

module.exports = router;