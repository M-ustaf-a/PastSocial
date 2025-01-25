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

router.get("/community/:userid", async(req,res)=>{
  try{
    const userId = req.session.userId;
    const {userid} = req.params;
    const communities = await Community.find({});
    let isStatus = false;
    if(userid === userId){
      const user = await User.findById(userId);
      if(!user){
        return res.status(404).send('user not found');
      }
      isStatus = true;
      res.render("profile.ejs", {user,isStatus, userId, communities});
    }else{
      const user = await User.findById(userid);
      if(!user){
        return res.status(404).send('user not found');
      }
      res.render('profile.ejs', {user, isStatus, userId, communities});
    }
  }catch(err){
    console.log(err);
  }
});

// api for show community in admin profile

router.get("/api/community/communities", async (req, res) => {
  try {
    const userId = req.session?.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized: User not logged in" });
    }

    const communities = await Community.find({ userid: userId });
    if (communities.length === 0) {
      return res.status(404).json({ message: "No communities found for the user" });
    }

    res.json(communities);
  } catch (err) {
    console.error("Error fetching communities:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


//show the community user profile
router.get("/community/:communityId/:userId/showProfile", async(req,res)=>{
  const {communityId, userId} = req.params;
  const community = await Community.findById(communityId);
  console.log(community);
  const user = await CommunityUser.findById(userId);
  console.log(user);
  res.render("communityUserProfile.ejs", {community,user})
})

module.exports = router;