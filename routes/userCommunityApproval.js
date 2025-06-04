const express = require("express");
const Community = require("../models/community");
const router = express.Router();
const multer = require("multer");
const { storage } = require("../cloudConfig");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const bcrypt = require("bcryptjs");
const CommunityUser = require("../models/communityUser");
const ApprovalCommunity = require("../models/approveCommunity");
const { checkCommunity } = require("../middleware");

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const imagesAllowed = [
      "profilePhoto"  // Fixed: Remove the bracket notation
    ];
    const videosAllowed = ["post[video]"];
    const verificationAllowed = ["CompanyListing[verification]"];

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

router.get("/community/:communityId/communityApproval", async(req, res) => {
  const {communityId} = req.params;
  const community = await Community.findById(communityId);
  console.log(community);
  res.render("communityUser/communityApproval", {community});
});

router.post(
  "/community/:communityId/communityApproval",
  upload.single("profilePhoto"), // Fixed: Remove the bracket notation
  async (req, res) => {
    try {
      const { communityId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(communityId)) {
        return res.status(400).send("Invalid community ID");
      }

      const community = await Community.findById(communityId);
      if (!community) {
        return res.status(404).send("Community not found");
      }

      // Fixed: Create user with direct req.body instead of req.body.CommunityApproval
      const user = new ApprovalCommunity(req.body);

      if (req.file) {
        user.profilePhoto = {
          url: req.file.path,
          filename: req.file.filename,
        };
      }

      user.communityId = communityId;
      await user.save();

      res.render("submit.ejs");
    } catch (err) {
      console.error("Something is wrong", err);
      res.status(500).send("An error occurred while processing the request.");
    }
  }
);

router.get("/community/:communityId/membershipApproval", async (req, res) => {
  try {
    const communityId = req.params.communityId;
    const community = await Community.findById(communityId);
    const users = await ApprovalCommunity.find({});
    res.render("approvedNotification", { community, users });
  } catch (err) {
    console.log("Something is wrong:", err);
  }
});

router.get(
  "/community/:communityId/membershipApproval/:userId/show",
  async (req, res) => {
    try {
      const { userId, communityId } = req.params;

      console.log(
        `Fetching details for userId: ${userId} and communityId: ${communityId}`
      );

      // Fetch the user by ID
      const user = await ApprovalCommunity.findById(userId);
      console.log(user);
      user.isRead = true;
      await user.save();
      console.log(user);
      if (!user) {
        return res.status(404).send("User not found");
      }
      console.log("User details:", user);

      // Fetch the community by ID
      const community = await Community.findById(communityId);
      if (!community) {
        return res.status(404).send("Community not found");
      }
      console.log("Community details:", community);

      // Render the view
      res.render("approvalShow", { community, user, userId });
    } catch (error) {
      console.error("Error fetching data:", error);
      res.status(500).send("Internal Server Error");
    }
  }
);

router.post(
  "/community/:communityId/adminApproval/:userId/show/adminApproved",
  async (req, res) => {
    try {
      const { email, approved } = req.body;
      let {communityId} = req.params;
      const password = Math.random().toString(36).substr(2, 8); // Random password
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await ApprovalCommunity.findOne({ email });
      console.log(user);
      
      if (approved === "on") { // Fixed: Use === instead of ==
        const community = await Community.findById(communityId);
        
        const newUser = new CommunityUser({
          name: user.name,
          email: user.email,
          password: hashedPassword,
          role: user.desiredRole, // Fixed: Use desiredRole from the form
          image: user.profilePhoto, // Fixed: Use profilePhoto
          company: user.company,
          communityId: communityId,
        });
        
        await newUser.save();
        await community.save();
        
        // Fixed: Use deleteOne() properly
        await user.deleteOne();
        
        await transporter.sendMail({
          from: `"Community Platform" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: 'Your Membership Approval - Account Details',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.6; color: #333;">
              <div style="background-color: #f4f4f4; padding: 15px 20px; border-bottom: 2px solid #007bff;">
                <h2 style="color: #333; margin: 0;">Membership Approved</h2>
              </div>
              
              <div style="padding: 20px; background-color: #ffffff;">
                <p>Dear ${newUser.name},</p>
                
                <p>We are pleased to inform you that your membership request has been <strong>approved</strong>. Welcome to our community!</p>
                
                <div style="background-color: #f8f9fa; border: 1px solid #e9ecef; padding: 15px; margin: 20px 0; border-radius: 5px;">
                  <h3 style="margin-top: 0; color: #007bff;">Account Access Information</h3>
                  <p><strong>Username:</strong> ${newUser.name}</p>
                  <p><strong>Password:</strong> ${password}</p>
                  
                  <div style="background-color: #ffff00; padding: 10px; border-radius: 5px; margin: 10px 0;">
                    <strong>Important Security Notice:</strong> 
                    For your account security, please change your temporary password immediately upon first login.
                  </div>
                </div>
                
                <p>To get started:</p>
                <ol style="margin-left: 20px; padding-left: 20px;">
                  <li>Visit our platform at [Login URL]</li>
                  <li>Enter your username and the provided temporary password</li>
                  <li>Follow the prompted steps to create a new, secure password</li>
                </ol>
                
                <p style="margin-top: 20px;">If you encounter any issues logging in, please contact our support team at [Support Email/Phone].</p>
                
                <p style="color: #666; font-size: 0.9em; margin-top: 30px;">
                  This is an automated message. Please do not reply directly to this email.
                </p>
              </div>
              
              <div style="background-color: #f4f4f4; padding: 10px; text-align: center; font-size: 0.8em; color: #666;">
                © ${new Date().getFullYear()} Community Platform | All Rights Reserved
              </div>
            </div>
          `,
          text: `Membership Approval
        
        Dear ${newUser.name},
        
        Your membership has been approved. 
        
        Login Details:
        Username: ${newUser.name}
        Password: ${password}
        
        IMPORTANT: For security reasons, please change your temporary password immediately upon first login.
        
        Getting Started:
        1. Visit our platform login page
        2. Enter your username and temporary password
        3. Follow prompts to create a new, secure password
        
        If you need assistance, contact our support team.
        
        Best regards,
        Community Platform Support`
        });
  
        res.send('Membership approved and credentials sent.');
      } else if(approved === 'reject') { // Fixed: Check for 'reject' instead of 'on'
        await user.deleteOne();
  
        // Notify the user of rejection
        await transporter.sendMail({
          from: `"Community Membership Review" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: 'Update Regarding Your Membership Application',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.6; color: #333;">
              <div style="background-color: #f4f4f4; padding: 15px 20px; border-bottom: 2px solid #007bff;">
                <h2 style="color: #333; margin: 0;">Membership Application Review</h2>
              </div>
              
              <div style="padding: 20px; background-color: #ffffff;">
                <p>Dear Applicant,</p>
                
                <p>Thank you for your interest in joining our community. After careful review, we regret to inform you that your membership application has not been approved at this time.</p>
                
                <div style="background-color: #f8f9fa; border: 1px solid #e9ecef; padding: 15px; margin: 20px 0; border-radius: 5px;">
                  <h3 style="margin-top: 0; color: #007bff;">Application Status: Not Approved</h3>
                  <p>While we appreciate the time and effort you've put into your application, we are unable to move forward with your membership request.</p>
                </div>
                
                <h4 style="color: #007bff;">Next Steps and Considerations</h4>
                <p>We encourage you to:</p>
                <ul style="margin-left: 20px; padding-left: 20px;">
                  <li>Review the membership criteria on our website</li>
                  <li>Address any potential areas of improvement</li>
                  <li>Consider reapplying in the future when circumstances may have changed</li>
                </ul>
                
                <p>If you would like more specific feedback about your application, please contact our membership review team at [Contact Email/Phone]. We are committed to providing constructive guidance.</p>
                
                <p style="color: #666; font-size: 0.9em; margin-top: 30px;">
                  This is an automated message sent as part of our application review process.
                </p>
              </div>
              
              <div style="background-color: #f4f4f4; padding: 10px; text-align: center; font-size: 0.8em; color: #666;">
                © ${new Date().getFullYear()} Community Membership Team | All Rights Reserved
              </div>
            </div>
          `,
          text: `Membership Application Review
        
        Dear Applicant,
        
        Thank you for your interest in joining our community. After careful consideration, we regret to inform you that your membership application has not been approved at this time.
        
        Application Status: Not Approved
        
        While we appreciate your effort, we are unable to move forward with your membership request. We encourage you to:
        - Review our membership criteria
        - Address potential areas of improvement
        - Consider reapplying in the future
        
        For more specific feedback, please contact our membership review team at [Contact Email/Phone].
        
        Best regards,
        Community Membership Team`
        });
  
        res.send('Membership request rejected.');
      } 
    } catch(err) {
      console.log(err);
      res.status(500).send('An error occurred while processing the request.');
    }   
  }
); 

router.get("/community/:communityId/login", async(req,res) => {
  const {communityId} = req.params;
  const community = await Community.findById(communityId);
  res.render("communityUser/login.ejs", {community});
});

router.post("/community/:communityId/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(email, password);
    const { communityId } = req.params;

    console.log("Login Request:", { email, communityId });

    // Validate communityId
    if (!communityId || !mongoose.Types.ObjectId.isValid(communityId)) {
      return res.status(400).send("Invalid community ID.");
    }

    // Check if community exists
    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).send("Community not found.");
    }

    // Find user in the community
    const user = await CommunityUser.findOne({ email, communityId });
    if (!user) {
      return res.status(404).send("User not found in this community.");
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).send("Incorrect password.");
    }

    // Ensure session exists
    if (!req.session) {
      return res.status(500).send("Session not initialized.");
    }

    // Set session data correctly
    req.session.communityUser = { id: user._id.toString(), communityId };
    console.log("Session Data Set:", req.session.communityUser);

    // Save session before redirecting
    req.session.save((err) => {
      if (err) {
        console.error("Session save error:", err);
        return res.status(500).send("Failed to save session.");
      }
      res.redirect(`/community/${communityId}/main`);
    });

  } catch (err) {
    console.error("Error in login system:", err);
    res.status(500).send("An error occurred during login.");
  }
});

router.get("/community/:id/logout", (req,res) => {
  let {id} = req.params;
  console.log(id);
  req.session.destroy((err) => {
    if(err){
      console.error("Error during logout:", err); 
      res.redirect(`/community/${id}/login`);
    }
    res.redirect(`/community/${id}/main`);
  });
});

module.exports = router;