const express = require("express");
const Approvaladmin = require( "../models/adminApproval" );
const router = express.Router();
const multer = require("multer");
const {storage} = require("../cloudConfig");
const User = require( "../models/user" );
const upload = multer({storage});
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const Notification = require( "../models/notification" );
const { saveRedirectUrl, isLoggedIn, isAuthenticated } = require( "../middleware" );
const passport = require( "passport" );
const Community = require( "../models/community" );
require("dotenv").config();

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

transporter.verify((error) => {
    if (error) {
        console.error("SMTP verification failed:", error);
    } else {
        console.log("SMTP server is ready to send emails");
    }
});

router.get("/admin/login", (req,res)=>{
    res.render("./admin/login.ejs");
})


router.post("/admin/login", async(req,res)=>{
  const {email, password} = req.body;
  try{
    const user = await User.findOne({email});
    if(!user){
      return res.render("admin/login", {error: "Invalid email or password"});
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if(!isMatch){
      return res.render("admin/login", {error: "Invalid email or password"});
    }
    req.session.userId = user._id //store user Id in session
    res.redirect("/community");
  }catch(err){
    console.error("Error during login:", err);
    res.render("/admin/login", {error: "An error occurred. Please try again later."});
  }
});

router.get("/admin/logout", (req,res)=>{
  req.session.destroy((err)=>{
    if(err){
      console.error("Error during logout:", err);
      res.redirect("/community");
    }
    res.clearCookie("connect.sid");
    res.redirect("/admin/login")
  })
})


router.get("/admindashboard", async(req,res)=>{
    const {id} = req.params;
    const notifications = await Notification.find({
        type: 'membership_request',
        isRead: false,
    }).sort({createdAt: -1}).limit(10);

    const unreadCount = await Notification.countDocuments({
        type: 'message_request',
        isRead: false,
    });
    res.render("./admin/dashboard", {notifications, unreadCount, id});
});

router.get("/admin/profile", isAuthenticated, async (req, res) => {
  try {
    const id = req.session.userId; // User ID from session
    const user = await User.findById(id); // Find the user
    if (!user) {
      return res.status(404).send("User not found");
    }

    const communities = await Community.find({ owner: id }); // Filter communities by owner

    // Render profile with user and their communities
    res.render("admin/profile", { user, communities });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error");
  }
});


router.get("/admindashboard/:id/show", async(req,res)=>{
    const {id} = req.params;
    const notification = await Notification.findById(id);
    notification.isRead = true;
    res.render("./admin/notificationShow", {notification});
})

router.get("/admin/approval", (req,res)=>{
    res.render("admin/approvalForm");
});

router.post("/adminApproval", upload.single("approval[image]"), async(req,res)=>{
    try {
        const { name, email, bio, role, company, reason } = req.body.approval;

        if (!name || !email || !bio || !role || !req.file) {
            return res.status(400).send("All required fields must be provided, including an image.");
        }

        const { path: url, filename } = req.file;

        const newRequest = new Approvaladmin({
            name,
            email,
            bio,
            role,
            company,
            reason,
            image: { url, filename },
        });
        await newRequest.save();
        
        const notification = new Notification({
            type: "membership_request",
            content: { requestId: newRequest._id, name, email, bio, role, company, imageUrl: url },
        });

        await notification.save();

        const sanitizedHTML = `
            <p>A new membership request has been submitted:</p>
            <ul>
                <li>Name: ${name}</li>
                <li>Email: ${email} </li>
                <li>Bio: ${bio}</li>
                <li>Role: ${role}</li>
                <li>Company: ${company}</li>
                <li>Reason: ${reason} </li>
            </ul>
            <p><a href="${url}">View Attached Image</a></p>
        `;

        await transporter.sendMail({
            from: `Admin Dashboard <${process.env.EMAIL_USER}>`,
            to: process.env.ADMIN_EMAIL,
            subject: "New Membership Request",
            html: sanitizedHTML,
        });

        res.status(200).send("Membership request submitted successfully!");
    } catch (err) {
        console.error("Error processing request:", err);
        res.status(500).send("An error occurred while processing the request.");
    }
});

router.post('/adminApprove', async (req, res) => {
    const { email, approved } = req.body;
    try {
      const member = await Approvaladmin.findOne({ email });
      console.log(member);
      if (!member) {
        return res.status(404).send('Membership request not found.');
      }
      let user = await User.findOne({email});
      if(!user){
        user = new User({email});
      }
      

      if (approved === 'on') {
        const username = email.split('@')[0]; // Example username generation
        const password = Math.random().toString(36).substr(2, 8); // Random password
        const hashedPassword = await bcrypt.hash(password, 10);
        const image = member.image;
        const name = member.name;
        const boi = member.bio;
        const role = member.role;
        const company = member.company;
        user.username = username;
        user.email = email;
        user.password = hashedPassword;
        member.status = true;
        user.image = image;
        user.adminData.name = name;
        user.adminData.company = company;
        user.adminData.role = role;
        user.adminData.boi = boi;
        
        await member.save();
        await user.save();
        // Send credentials to the user
        await transporter.sendMail({
          from: `"Community Platform" <${process.env.EMAIL_USER}>`,
          
          // Send to the newly approved member's email
          to: email,
          
          // Clear and informative subject line
          subject: 'Your Membership Approval - Account Details',
          
          // Create a more comprehensive and secure communication
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.6; color: #333;">
              <div style="background-color: #f4f4f4; padding: 15px 20px; border-bottom: 2px solid #007bff;">
                <h2 style="color: #333; margin: 0;">Membership Approved</h2>
              </div>
              
              <div style="padding: 20px; background-color: #ffffff;">
                <p>Dear ${username},</p>
                
                <p>We are pleased to inform you that your membership request has been <strong>approved</strong>. Welcome to our community!</p>
                
                <div style="background-color: #f8f9fa; border: 1px solid #e9ecef; padding: 15px; margin: 20px 0; border-radius: 5px;">
                  <h3 style="margin-top: 0; color: #007bff;">Account Access Information</h3>
                  <p><strong>Username:</strong> ${username}</p><p><strong>Password:</strong> ${password}</p>
                  
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
          
          // Fallback plain text version for email clients that don't support HTML
          text: `Membership Approval
        
        Dear ${username},
        
        Your membership has been approved. 
        
        Login Details:
        Username: ${username}
        Password: ${hashedPassword}
        
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
      } else {
        // await member.deleteOne();
  
        // Notify the user of rejection
        await transporter.sendMail({
          // Use a clear, professional sender name
          from: `"Community Membership Review" <${process.env.EMAIL_USER}>`,
          
          // Send to the applicant's email
          to: email,
          
          // Neutral, direct subject line
          subject: 'Update Regarding Your Membership Application',
          
          // Develop a comprehensive HTML email template
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
          
          // Fallback plain text version
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
    } catch (err) {
      console.error(err);
      res.status(500).send('Error processing approval.');
    }
  });

module.exports = router;