const express = require('express');
const Community = require( '../models/community' );
const User = require( '../models/user' );
const router = express.Router();
const multer = require("multer");
const { storage } = require("../cloudConfig");
const CommunityUser = require("../models/communityUser");
const { isAuthenticated } = require( '../middleware' );
const Post = require( '../models/post' );
const mongoose = require("mongoose");
const uploadPost = require('../models/uploadPost');
const CommunityData = require( '../models/communityData' );
const ApprovalCommunity = require( '../models/approveCommunity' );
const Company = require( '../models/communityCompany' );

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
      if (
        file.fieldname === "post[image]" ||
        file.fieldname === "community[thumbnail]" ||
        file.fieldname === "upload[image]"
      ) {
        // Allow image files
        if (file.mimetype.startsWith("image/")) {
          cb(null, true);
        } else {
          cb(new Error("Only image files are allowed!"), false);
        }
      } else if (file.fieldname === "post[video]") {
        // Allow video files
        if (file.mimetype.startsWith("video/")) {
          cb(null, true);
        } else {
          cb(new Error("Only video files are allowed!"), false);
        }
      } else {
        cb(new Error("Invalid file type"), false);
      }
    },
});

router.get("/community",  async(req,res)=>{
    try{
        const Communities = await Community.find({});
        const userId = req.session.userId;
        const user = await User.findById(userId);
        res.render("community.ejs", {Communities, user});
    }catch(err){
        console.log(err);
    }
});

router.get('/createCommunity',isAuthenticated, async(req,res)=>{
   res.render("commForm");
})

//create community
router.post(
    "/communityForm",
    isAuthenticated,
    upload.single("community[thumbnail]"),
    async (req, res) => {
      try {
        // Ensure file upload is present
        if (!req.file) {
          throw new Error("File upload is required.");
        }
  
        // Extract file details
        const { path: url, filename } = req.file;
  
        // Retrieve user ID from the session
        const userId = req.session.userId; // Ensure `userId` is set correctly in the session
  
        // Validate userId as a valid ObjectId
        if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
          throw new Error("Invalid or missing user ID.");
        }
  
        // Fetch the user from the database
        const user = await User.findById(userId);
        if (!user) {
          throw new Error("User not found.");
        }
  
        // Create a new community instance with provided form data
        const newCommunity = new Community(req.body.community);
        newCommunity.thumbnail = { url, filename };
        newCommunity.useradmin = user;
        newCommunity.userid = user._id;
  
        // Save the new community
        await newCommunity.save();
  
        const data = new CommunityData({
          community: newCommunity.title,
          info: newCommunity.description
        });
        data.save();
        // Create and save a new CommunityUser instance
        const newUser = new CommunityUser({
          name: user.adminData.name,
          email: user.email,
          password: user.password,
          role: user.adminData.role,
          image: user.image,
          status: true,
          communityId: newCommunity._id,
          company: user.adminData.company,
        });
        await newUser.save();
  
        // Redirect to the community page
        res.redirect("/community");
      } catch (error) {
        // Log the error and redirect to the community creation page
        console.error("Community creation error:", error.message);
        res.redirect("/createCommunity");
      }
    }
);

// Show New Post Form for a Specific Community
router.get("/community/:communityId/posts/new", async (req, res) => {
    const { communityId } = req.params;
    try {
      // Find the specific community to pass to the view
      const currentCommunity = await Community.findById(communityId);
      res.render("new-community-post.ejs", { community: currentCommunity });
    } catch (error) {
      console.error("Error loading new post form:", error);
      res.status(500).send("An error occurred");
    }
});

router.get("/community/:communityId/posts/:postId", async (req, res) => {
  const { communityId, postId } = req.params;
  try {
    const community = await Community.findById(communityId);
    const post = await Post.findById(postId);

    if (!post || !community) {
      return res.status(404).send("Post or Community not found");
    }

    res.render("show.ejs", { post, community });
  } catch (error) {
    console.error("Error fetching post details:", error);
    res.status(500).send("An error occurred");
  }
});

// Create New Post(video) for a Specific Community
router.post(
  "/community/:communityId/posts",
  upload.fields([
    { name: "post[image]", maxCount: 10 },
    { name: "post[video]", maxCount: 1 },
  ]),
  async (req, res) => {
    const { communityId } = req.params;
    try {
      const newPost = new Post(req.body.post);

      // Set the community for this post
      newPost.community = communityId;

      // Process image uploads
      if (req.files["post[image]"]) {
        const imageUrls = req.files["post[image]"].map((file) => file.path);
        const imageFilenames = req.files["post[image]"].map(
          (file) => file.filename
        );

        newPost.image = {
          url: imageUrls,
          filename: imageFilenames,
        };
      }

      // Process video upload
      if (req.files["post[video]"]) {
        const videoFile = req.files["post[video]"][0];
        newPost.video = {
          url: videoFile.path,
          filename: videoFile.filename,
        };
      }

      await newPost.save();
      res.redirect(`/community/${communityId}/video`);
    } catch (error) {
      console.error("Post creation error:", error);
      res.redirect(`/community/${communityId}/posts/new`);
    }
  }
);

// community post suggestion route
router.post(
  "/community/:communityId/posts/:postId/suggestion",
  async (req, res) => {
    const { communityId, postId } = req.params;
    const { username1, suggestion } = req.body;
    try {
      const post = await Post.findById(postId);
      if (!post) return res.status(404).send("Post not found");

      post.suggestions.push({ username1, suggestion });
      await post.save();

      req.flash("success", "Suggestion added successfully!");
      res.redirect(`/community/${communityId}/posts/${postId}`);
    } catch (error) {
      console.error("Suggestion error:", error);
      req.flash("error", "Failed to add suggestion");
      res.redirect(`/community/${communityId}/posts/${postId}`);
    }
  }
);

// community main page Get route
router.get("/community/:communityId/main", async (req, res) => {
  try {
    const { communityId } = req.params;

    // Validate if communityId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(communityId)) {
      return res.status(400).send("Invalid community ID");
    }

    // Retrieve the current user's ID from the session
    const currUserId = req.session?.communityUser?.id;
    // Fetch the current user
    const currUser = await CommunityUser.findById(currUserId);

    // Fetch the community by ID
    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).send("Community not found");
    }

    // Fetch posts uploaded in the community
    const newUploadPost = await uploadPost.find({ community: communityId }).populate("user", "name image");
    
    console.log("Fetched Posts:", newUploadPost);

    // Render the main view with the fetched data
    res.render("main", { currUser, community, newUploadPost, communityId });
  } catch (error) {
    console.error("Error in /community/:communityId/main:", error);
    res.status(500).send("Internal Server Error");
  }
});

// community main page Post route
router.post(
  "/community/:communityId/main",
  upload.single("upload[image]"),
  async (req, res) => {
    try {
      // Validate file upload
      if (!req.file) {
        return res.status(400).send("No file uploaded.");
      }

      // Validate session user ID
      const userId = req.session?.communityUser?.id; // Fixed session key structure
      if (!userId) {
        return res.status(401).send("User not authenticated.");
      }
      
      const { communityId } = req.params;

      // Validate communityId
      if (!mongoose.Types.ObjectId.isValid(communityId)) {
        return res.status(400).send("Invalid community ID.");
      }

      const { path: url, filename } = req.file;

      // Find the user by session ID
      const user = await CommunityUser.findById(userId);
      console.log(user);
      if (!user) {
        return res.status(404).send("User not found.");
      }

      // Find the community by ID
      const community = await Community.findById(communityId);
      if (!community) {
        return res.status(404).send("Community not found.");
      }

      // Validate and create a new post
      if (!req.body.upload) {
        return res.status(400).send("Post data missing.");
      }

      const newUploadPost = new uploadPost({
        ...req.body.upload,
        image: { url, filename },
        community: community._id, // Store references as IDs
        user: user,
      });

      await newUploadPost.save();

      // Save session before redirect
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).send("Failed to save session.");
        }
        res.redirect(`/community/${communityId}/main`);
      });
      
    } catch (error) {
      console.error("Error handling post:", error);
      res.status(500).send("An error occurred while processing your request.");
    }
  }
);

// community link page Get route
router.get("/community/:communityId/link", async (req, res) => {
  try {
    const { communityId } = req.params;
    const currUserId = req.session?.communityUser?.id;

    if (!mongoose.Types.ObjectId.isValid(communityId)) {
      return res.status(400).send("Invalid community ID");
    }

    // Fetch the community
    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).send("Community not found.");
    }

    // Fetch the current user
    const currUser = await CommunityUser.findById(currUserId);

    // Fetch all users excluding the logged-in user

    const users = await CommunityUser.find({ _id: { $ne: currUserId } });
    console.log("Logged-in User:", currUser);
    console.log("Available Users:", users);

    res.render("link", { currUser, users, communityId, community });
  } catch (error) {
    console.error("Error in /community/:communityId/link:", error);
    res.status(500).send("Internal Server Error");
  }
});

// community video page Get route
router.get("/community/:communityId/video", async (req, res) => {
  try {
    const { communityId } = req.params;

    // Ensure communityId is valid
    if (!mongoose.Types.ObjectId.isValid(communityId)) {
      return res.status(400).send("Invalid community ID");
    }

    // Fetch the specific community
    const currentCommunity = await Community.findById(communityId);
    if (!currentCommunity) {
      return res.status(404).send("Community not found");
    }

    // Fetch posts for this community
    const communityPosts = await Post.find({ community: communityId });

    // Retrieve logged-in user details from session
    const sessionUser = req.session?.communityUser;
    if (!sessionUser) {
      return res.redirect(`/community/${communityId}/login`);
    }

    // Ensure user belongs to the current community
    if (sessionUser.communityId !== communityId) {
      console.log("No matching user for this community");
      return res.redirect(`/community/${communityId}/login`);
    }

    // Fetch the correct user based on session
    const currUser = await CommunityUser.findById(sessionUser.id);
    if (!currUser) {
      return res.status(404).send("User not found");
    }

    console.log("User Found:", currUser);

    res.render("video.ejs", {
      community: currentCommunity,
      videos: communityPosts,
      currUser,
      communityId
    });

  } catch (error) {
    console.error("Error fetching community posts:", error);
    res.status(500).send("An error occurred while fetching community posts.");
  }
});

// community meeting Get route
router.get("/community/:communityId/meeting", async (req, res) => {
  try {
    const { communityId } = req.params;
    const sessionUser = req.session?.communityUser;

    // Ensure community exists
    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).send("Community not found");
    }

    // Ensure user is authenticated
    if (!sessionUser) {
      console.log("User not logged in, redirecting to login");
      return res.redirect(`/community/${communityId}/login`);
    }

    // Ensure user belongs to this community
    if (sessionUser.communityId.toString() !== communityId) {
      console.log("No matching user for this community");
      return res.redirect(`/community/${communityId}/login`);
    }

    res.render("meeting.ejs", { community, communityId });
  } catch (error) {
    console.error("Error fetching meeting page:", error);
    res.status(500).send("An error occurred while fetching the meeting page.");
  }
});

//community notification Get route

router.get("/community/:communityId/notification", async (req, res) => {
  try {
    const { communityId } = req.params;
    const sessionUser = req.session?.communityUser;
    console.log(sessionUser);

    console.log("Session Data (req.session.communityUser):", sessionUser);

    // Ensure community exists
    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).send("Community not found");
    }

    // Ensure user is authenticated
    if (!sessionUser) {
      console.log("User not logged in, redirecting to login");
      return res.redirect(`/community/${communityId}/login`);
    }

    // Ensure user belongs to this community
    if (sessionUser.communityId.toString() !== communityId) {
      console.log("No matching user for this community");
      return res.redirect(`/community/${communityId}/login`);
    }

    // Fetch user from CommunityUser
    const currUser = await CommunityUser.findById(sessionUser.id);
    if (!currUser) {
      return res.status(404).send("User not found");
    }
    console.log("User Found:", currUser);

    // Fetch notifications related to this community
    const users = await ApprovalCommunity.find({ community: communityId }).sort({ createdAt: -1 });

    res.render("notification.ejs", { community, users, currUser, communityId });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).send("An error occurred while fetching notifications.");
  }
});

// community company Get route
router.get("/community/:communityId/company", async (req, res) => {
  try {
    const { communityId } = req.params;
    const sessionUser = req.session?.communityUser;
    const companies = await Company.find({});
    console.log(companies);


    console.log("Session Data (req.session.communityUser):", sessionUser);

    // Ensure community exists
    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).send("Community not found");
    }

    // Ensure user is authenticated
    if (!sessionUser) {
      console.log("User not logged in, redirecting to login");
      return res.redirect(`/community/${communityId}/login`);
    }

    // Ensure user belongs to this community
    if (sessionUser.communityId.toString() !== communityId) {
      console.log("No matching user for this community");
      return res.redirect(`/community/${communityId}/login`);
    }

    // Fetch the logged-in user
    const currUser = await CommunityUser.findById(sessionUser.id);
    if (!currUser) {
      return res.status(404).send("User not found");
    }
    console.log("User Found:", currUser);

    res.render("company.ejs", { community, currUser, communityId, companies });
  } catch (error) {
    console.error("Error fetching company page:", error);
    res.status(500).send("An error occurred while fetching the company page.");
  }
});

//community company listing get route
router.get("/community/:communityId/listingCompany", async(req,res)=>{
  try{
    res.render("companyProfile.ejs");
  }catch(err){
    console.log(err);
  }
})

module.exports = router;