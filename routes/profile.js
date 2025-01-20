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

router.get("/admin/profiles/store", isAuthenticated, async (req, res) => {
    try {
      const id = req.session.userId; // User ID from session
      const user = await User.findById(id); // Find the user
      if (!user) {
        return res.status(404).send("User not found");
      }
      console.log(user);
      const communities = await Community.find({});

      console.log(communities);
      // Render profile with user and their communities
      res.render("profile/store.ejs", { user, communities, id });
    } catch (error) {
      console.error(error);
      res.status(500).send("Internal server error");
    }
  });

router.get("/admin/profiles/gallery", async(req,res)=>{
    try {
        const id = req.session.userId; // User ID from session
        const user = await User.findById(id); // Find the user
        if (!user) {
          return res.status(404).send("User not found");
        }
    
        const communities = await Community.find({ owner: id }); // Filter communities by owner
    
        // Render profile with user and their communities
        res.render("profile/gallery.ejs", { user, communities });
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal server error");
    }
});

router.get("/admin/profiles/saved", async(req,res)=>{
    try {
        const id = req.session.userId; // User ID from session
        const user = await User.findById(id); // Find the user
        if (!user) {
          return res.status(404).send("User not found");
        }
    
        const communities = await Community.find({ owner: id }); // Filter communities by owner
    
        // Render profile with user and their communities
        res.render("profile/saved.ejs", { user, communities });
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal server error");
    }
});

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