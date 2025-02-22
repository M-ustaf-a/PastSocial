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
      res.render("profile.ejs", {user, isStatus, userId, communities});
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
  const currUserId = req.session?.communityUser?.userId;
  let isStatus = false;
  if(currUserId === userId){
    isStatus = true
  }
  res.render("communityUserProfile.ejs", {community,user,isStatus})
});

//Linkup
router.post("/api/users/link/:userId", async (req, res) => {
  try {
      const { userId } = req.params;
      
      // Validate if userId exists
      if (!userId) {
          return res.status(400).json({ error: "User ID is required" });
      }

      // Get both users
      const currUser = await User.findById(req.session.userId);
      const userToFollow = await User.findById(userId);

      // Validate if both users exist
      if (!currUser || !userToFollow) {
          return res.status(404).json({ error: "User not found" });
      }

      // Check if already following
      if (currUser.linkup && currUser.linkup.includes(userId)) {
          return res.status(400).json({ error: "Already following this user" });
      }

      // Initialize linkup arrays if they don't exist
      if (!currUser.linkup) currUser.linkup = [];
      if (!userToFollow.linkup) userToFollow.linkup = [];

      // Add users to each other's linkup arrays
      currUser.linkup.push(userId);
      userToFollow.linkup.push(req.session.userId);

      // Save both users
      await Promise.all([
          currUser.save(),
          userToFollow.save()
      ]);

      res.status(200).json({ message: "Successfully linked" });

  } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error while linking users" });
  }
});

router.delete("/api/users/unlink/:userId", async (req, res) => {
  try {
      const { userId } = req.body;

      // Validate if userId exists
      if (!userId) {
          return res.status(400).json({ error: "User ID is required" });
      }

      // Get both users
      const currUser = await User.findById(req.session.userId);
      const userToUnfollow = await User.findById(userId);

      // Validate if both users exist
      if (!currUser || !userToUnfollow) {
          return res.status(404).json({ error: "User not found" });
      }

      // Remove users from each other's linkup arrays
      currUser.linkup = currUser.linkup.filter(id => id.toString() !== userId);
      userToUnfollow.linkup = userToUnfollow.linkup.filter(id => id.toString() !== req.session.userId);

      // Save both users
      await Promise.all([
          currUser.save(),
          userToUnfollow.save()
      ]);

      res.status(200).json({ message: "Successfully unlinked" });

  } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error while unlinking users" });
  }
});

module.exports = router;