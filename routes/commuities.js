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
const AdminPortal = require( '../models/adminPortal' );
const nodemailer = require("nodemailer");
const bcrypt = require("bcryptjs");
const CompanyListing = require( '../models/companyListing' );

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const imagesAllowed = [
      "post[image]",
      "community[thumbnail]",
      "upload[image]",
      "CompanyListing[logo]"
    ];
    const videosAllowed = [ "post[video]" ];
    const verificationAllowed = [ "CompanyListing[verification]" ];

    if (imagesAllowed.includes(file.fieldname)) {
      // only image mimetypes
      if (file.mimetype.startsWith("image/")) {
        return cb(null, true);
      }
      return cb(new Error("Only image files are allowed for logos and images"), false);
    }
    if (videosAllowed.includes(file.fieldname)) {
      // only video mimetypes
      if (file.mimetype.startsWith("video/")) {
        return cb(null, true);
      }
      return cb(new Error("Only video files are allowed for videos"), false);
    }
    if (verificationAllowed.includes(file.fieldname)) {
      // allow PDF or images for verification docs
      if (
        file.mimetype === "application/pdf" ||
        file.mimetype.startsWith("image/")
      ) {
        return cb(null, true);
      }
      return cb(new Error("Only PDF or image files are allowed for verification documents"), false);
    }

    // if it's some other field (no file expected), just skip it
    cb(null, false);
  }
});


const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  pool: true,
  maxConnections: 5,
  rateLimit: 1000,
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
      if (!req.file) {
        throw new Error("File upload is required.");
      }

      const { path: url, filename } = req.file;
      const userId = req.session.userId;

      if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error("Invalid or missing user ID.");
      }

      const user = await User.findById(userId);
      if (!user) {
        throw new Error("User not found.");
      }

      const newCommunity = new Community(req.body.community);
      newCommunity.thumbnail = { url, filename };
      newCommunity.useradmin = user;
      newCommunity.userid = user._id;

      await newCommunity.save();

      const data = new CommunityData({
        community: newCommunity.title,
        info: newCommunity.description,
      });
      await data.save();

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

      const password = Math.random().toString(36).substr(2, 8);
      const hashedPassword = await bcrypt.hash(password, 10);

      const newAdminPortal = new AdminPortal({
        name: user.adminData.name,
        email: user.email,
        communityId: newCommunity._id,
        password: hashedPassword,
      });

      await newAdminPortal.save();

      await transporter.sendMail({
        from: `"Admin Portal"<${process.env.EMAIL_USER}>`,
        to: newAdminPortal.email, // Fixed undefined `email`
        subject: "Your Admin Portal - Your Account Details",
        html: `
          <div style="font-family: 'Arial', sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa;">
              <div style="background-color: #A82400; padding: 30px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Admin Portal!</h1>
              </div>

              <div style="padding: 40px 30px; background-color: #ffffff;">
                  <div style="border-left: 4px solid #A82400; padding-left: 15px; margin-bottom: 30px;">
                      <p style="color: #333; margin: 0; font-size: 16px;">Dear ${
                        newAdminPortal.name || newCommunity.title
                      },</p>
                      <p style="color: #666; margin: 10px 0 0 0;">
                          Your admin login details
                      </p>
                  </div>

                  <div style="background-color: #fee4bd; border-radius: 8px; padding: 25px; margin: 30px 0;">
                      <h2 style="color: #A82400; margin: 0 0 20px 0; font-size: 18px;">Your Login Credentials</h2>
                      <div style="margin-bottom: 15px;">
                          <strong style="color: #333;">CommunityId:</strong>
                          <span style="color: #666; margin-left: 10px;">${newAdminPortal.communityId}</span>
                      </div>
                      <div style="margin-bottom: 15px;">
                          <strong style="color: #333;">Temporary Password:</strong>
                          <span style="color: #666; margin-left: 10px;">${password}</span>
                      </div>
                      <div style="background-color: #fff3cd; padding: 15px; border-radius: 6px; margin-top: 20px;">
                          <strong style="color: #856404;">🔐 Security Notice:</strong>
                          <p style="color: #856404; margin: 10px 0 0 0; font-size: 14px;">
                              Please change your password immediately after your first login.
                          </p>
                      </div>
                  </div>

                  <div style="margin: 30px 0;">
                      <h3 style="color: #A82400; margin-bottom: 20px; font-size: 18px;">Getting Started</h3>
                      <ol style="color: #666; padding-left: 20px;">
                          <li style="margin-bottom: 15px;">
                              Visit our platform at 
                              <a href="https://pastsocial.onrender.com/adminLoginPanel/713af207-d906-4d49-85cb-dddbde483a59/${newAdminPortal.communityId}" style="color: #A82400; text-decoration: none;">
                                  login.community.com
                              </a>
                          </li>
                          <li style="margin-bottom: 15px;">Enter your username and temporary password</li>
                          <li style="margin-bottom: 15px;">Set up your new secure password</li>
                          <li style="margin-bottom: 15px;">Complete your profile information</li>
                      </ol>
                  </div>

                  <div style="border-top: 1px solid #eee; margin-top: 30px; padding-top: 30px;">
                      <p style="color: #666; font-size: 14px;">
                          Need help? Contact our support team at 
                          <a href="mailto:support@community.com" style="color: #A82400; text-decoration: none;">support@community.com</a>
                      </p>
                  </div>
              </div>

              <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
                  <p style="color: #666; font-size: 12px; margin: 0;">
                      © ${new Date().getFullYear()} Community Platform. All rights reserved.
                  </p>
              </div>
          </div>
      `,
        text: `Admin Portal!

Dear ${newAdminPortal.name || newCommunity.title},

Your membership has been approved! Here are your login credentials:

CommunityId: ${newAdminPortal.communityId}
Temporary Password: ${password}

IMPORTANT: Please change your password after your first login.

Getting Started:
1. Visit our platform at login.adminPortal
2. Enter your username and temporary password
3. Set up your new secure password
4. Complete your profile information

Need help? Contact us at support@community.com

Best regards,
Community Platform Team`,
      });

      res.redirect("/community");
    } catch (error) {
      console.error("Community creation error:", error.message);
      res.redirect("/createCommunity");
    }
  }
);

// Show New Post Form for a Specific Community
// router.get("/community/:communityId/posts/new", async (req, res) => {
//     const { communityId } = req.params;
//     try {
//       // Find the specific community to pass to the view
//       const currentCommunity = await Community.findById(communityId);
//       res.render("new-community-post.ejs", { community: currentCommunity });
//     } catch (error) {
//       console.error("Error loading new post form:", error);
//       res.status(500).send("An error occurred");
//     }
// });


// Create New Post(video) for a Specific Community
// router.post(
//   "/community/:communityId/posts",
//   upload.fields([
//     { name: "post[image]", maxCount: 10 },
//     { name: "post[video]", maxCount: 1 },
//   ]),
//   async (req, res) => {
//     const { communityId } = req.params;
//     try {
//       const newPost = new Post(req.body.post);

//       // Set the community for this post
//       newPost.community = communityId;

//       // Process image uploads
//       if (req.files["post[image]"]) {
//         const imageUrls = req.files["post[image]"].map((file) => file.path);
//         const imageFilenames = req.files["post[image]"].map(
//           (file) => file.filename
//         );

//         newPost.image = {
//           url: imageUrls,
//           filename: imageFilenames,
//         };
//       }

//       // Process video upload
//       if (req.files["post[video]"]) {
//         const videoFile = req.files["post[video]"][0];
//         newPost.video = {
//           url: videoFile.path,
//           filename: videoFile.filename,
//         };
//       }

//       await newPost.save();
//       res.redirect(`/community/${communityId}/video`);
//     } catch (error) {
//       console.error("Post creation error:", error);
//       res.redirect(`/community/${communityId}/posts/new`);
//     }
//   }
// );

// community main page Get route
router.get("/community/:communityId/main", async (req, res) => {
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

    // Validate if communityId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(communityId)) {
      return res.status(400).send("Invalid community ID");
    }

    // Retrieve the current user's ID from the session
    // const currUserId = req.session?.communityUser?.id;
    // Fetch the current user
    // const currUser = await CommunityUser.findById(currUserId);

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


//Virtualworld Get route
router.get("/community/:communityId/virtualworld", async(req,res)=>{
  const {communityId} = req.params;
  const community = await Community.findById(communityId);
  console.log(community);
  res.render("virtualWorld.ejs", {community});
})

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

    res.render("listingCompany.ejs", { community, currUser, communityId, companies });
  } catch (error) {
    console.error("Error fetching company page:", error);
    res.status(500).send("An error occurred while fetching the company page.");
  }
});

//community company listing get route
router.get("/community/:communityId/listingCompany", async(req,res)=>{
  try{
    const {communityId} = req.params;
    const sessionUser = req.session?.communityUser;
    const community = await Community.findById(communityId);
    if (!sessionUser) {
      console.log("User not logged in, redirecting to login");
      return res.redirect(`/community/${communityId}/login`);
    }
    if (sessionUser.communityId.toString() !== communityId) {
      console.log("No matching user for this community");
      return res.redirect(`/community/${communityId}/login`);
    }
    const currUser = await CommunityUser.findById(sessionUser.id);
    if(!currUser){
      res.status(404).send("User is not found");
    }
    res.render("listingCompanyForm.ejs", {community, currUser, communityId});
  }catch(err){
    console.log(err);
  }
});

//community company listing post route
router.post(
  "/community/:communityId/listingCompany",
  upload.fields([
    { name: "CompanyListing[logo]", maxCount: 1 },
    { name: "CompanyListing[verification]", maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const { communityId } = req.params;
      const community = await Community.findById(communityId);

      // 1️ If your form ever posted a nested object directly, use it:
      let companyData = req.body.CompanyListing || {};
      
   
      // 2️ Otherwise, reconstruct from the flat keys
      if (!req.body.CompanyListing) {
        companyData = {};
        for (let key in req.body) {
          const m = key.match(/^CompanyListing\[(.+)\]$/);
          if (m) {
            companyData[m[1]] = req.body[key];
          }
        }
      }

      // 3️ Convert checkbox strings ("on"/undefined) to real booleans
      companyData.termsAgreed   = !!req.body["CompanyListing[termsAgreed]"];
      companyData.dataConsent   = !!req.body["CompanyListing[dataConsent]"];
      // marketingConsent is optional
      companyData.marketingConsent = !!req.body["CompanyListing[marketingConsent]"];

      // 4️ Convert foundedYear to Number
      if (companyData.foundedYear) {
        companyData.foundedYear = Number(companyData.foundedYear);
      }

      // 5️ Attach file info if present
      if (req.files["CompanyListing[logo]"]) {
        const file = req.files["CompanyListing[logo]"][0];
        companyData.logo = { url: file.path, filename: file.filename };
      }
      if (req.files["CompanyListing[verification]"]) {
        const file = req.files["CompanyListing[verification]"][0];
        companyData.verification = { url: file.path, filename: file.filename };
      }

      // 6️ Build & save the Mongoose document
      const newCompany = new CompanyListing({
        ...companyData,
        communityId
      });
      companyData.time = new Date();
      const savedCompany = await newCompany.save();
      console.log(companyData);
      res.render("reviewCompany.ejs", {companyData, community});

    } catch (error) {
      console.error("Error saving company:", error);
      // If it's a Mongoose validation error, send details back
      if (error.name === 'ValidationError') {
        return res.status(400).json({ errors: error.errors });
      }
      res.status(500).json({ error: "An error occurred while saving the company" });
    }
  }
);

module.exports = router;