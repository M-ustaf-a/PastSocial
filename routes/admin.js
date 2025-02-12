const express = require("express");
const Approvaladmin = require("../models/adminApproval");
const router = express.Router();
const multer = require("multer");
const { storage } = require("../cloudConfig");
const User = require("../models/user");
const upload = multer({ storage });
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const Notification = require("../models/notification");
const {
  saveRedirectUrl,
  isLoggedIn,
  isAuthenticated,
  isCompanyUser,
} = require("../middleware");
const passport = require("passport");
const Community = require("../models/community");
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

router.get("/admin/login", (req, res) => {
  res.render("./admin/login.ejs");
});

router.post("/admin/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.render("admin/login", { error: "Invalid email or password" });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.render("admin/login", { error: "Invalid email or password" });
    }
    req.session.userId = user._id; //store user Id in session
    res.redirect("/community");
  } catch (err) {
    console.error("Error during login:", err);
    res.render("/admin/login", {
      error: "An error occurred. Please try again later.",
    });
  }
});

router.get("/admin/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error during logout:", err);
      res.redirect("/community");
    }
    res.clearCookie("connect.sid");
    res.redirect("/admin/login");
  });
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

router.get("/admindashboard/:id/show", async (req, res) => {
  const { id } = req.params;
  const notification = await Notification.findById(id);
  notification.isRead = true;
  res.render("./admin/notificationShow", { notification });
});

router.get("/admin/approval", (req, res) => {
  res.render("admin/approvalForm");
});

router.post(
  "/admin/approval",
  upload.single("approval[image]"),
  async (req, res) => {
    try {
      const { name, email, bio, role, company, reason } = req.body.approval;

      if (!name || !email || !bio || !role || !req.file) {
        return res
          .status(400)
          .send("All required fields must be provided, including an image.");
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
        content: {
          requestId: newRequest._id,
          name,
          email,
          bio,
          role,
          company,
          imageUrl: url,
        },
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
      res.render("submit.ejs");
      // res.status(200).send("Membership request submitted successfully!");
    } catch (err) {
      console.error("Error processing request:", err);
      res.status(500).send("An error occurred while processing the request.");
    }
  }
);

router.post("/adminApprove", async (req, res) => {
  const { email, decision } = req.body;
  try {
    console.log(decision);
    const member = await Approvaladmin.findOne({ email });
    console.log(member);
    if (!member) {
      return res.status(404).send("Membership request not found.");
    }
    let user = await User.findOne({ email });
    if (!user) {
      user = new User({ email });
    }

    if (decision === "approved") {
      const username = email.split("@")[0];
      const password = Math.random().toString(36).substr(2, 8);
      const hashedPassword = await bcrypt.hash(password, 10);
      const image = member.image;
      const name = member.name;
      const boi = member.bio;
      const role = member.role;
      const company = member.company;

      // Update user data
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

      // Approval Email Template
      await transporter.sendMail({
        from: `"Community Platform" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Welcome to Our Community - Your Account Details",
        html: `
                  <div style="font-family: 'Arial', sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa;">
                      <!-- Header -->
                      <div style="background-color: #A82400; padding: 30px; text-align: center;">
                          <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Welcome to Our Community!</h1>
                      </div>

                      <!-- Main Content -->
                      <div style="padding: 40px 30px; background-color: #ffffff;">
                          <div style="border-left: 4px solid #A82400; padding-left: 15px; margin-bottom: 30px;">
                              <p style="color: #333; margin: 0; font-size: 16px;">Dear ${
                                name || username
                              },</p>
                              <p style="color: #666; margin: 10px 0 0 0;">Your membership has been approved! We're excited to have you join our community.</p>
                          </div>

                          <!-- Credentials Box -->
                          <div style="background-color: #fee4bd; border-radius: 8px; padding: 25px; margin: 30px 0;">
                              <h2 style="color: #A82400; margin: 0 0 20px 0; font-size: 18px;">Your Login Credentials</h2>
                              <div style="margin-bottom: 15px;">
                                  <strong style="color: #333;">Username:</strong>
                                  <span style="color: #666; margin-left: 10px;">${username}</span>
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

                          <!-- Getting Started Steps -->
                          <div style="margin: 30px 0;">
                              <h3 style="color: #A82400; margin-bottom: 20px; font-size: 18px;">Getting Started</h3>
                              <ol style="color: #666; padding-left: 20px;">
                                  <li style="margin-bottom: 15px;">Visit our platform at <a href="https://pastsocial.onrender.com/admin/login" style="color: #A82400; text-decoration: none;">login.community.com</a></li>
                                  <li style="margin-bottom: 15px;">Enter your username and temporary password</li>
                                  <li style="margin-bottom: 15px;">Set up your new secure password</li>
                                  <li style="margin-bottom: 15px;">Complete your profile information</li>
                              </ol>
                          </div>

                          <!-- Support Section -->
                          <div style="border-top: 1px solid #eee; margin-top: 30px; padding-top: 30px;">
                              <p style="color: #666; font-size: 14px;">
                                  Need help? Contact our support team at 
                                  <a href="mailto:support@community.com" style="color: #A82400; text-decoration: none;">support@community.com</a>
                              </p>
                          </div>
                      </div>

                      <!-- Footer -->
                      <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
                          <p style="color: #666; font-size: 12px; margin: 0;">
                              © ${new Date().getFullYear()} Community Platform. All rights reserved.
                          </p>
                      </div>
                  </div>
              `,
        text: `Welcome to Our Community!

Dear ${name || username},

Your membership has been approved! Here are your login credentials:

Username: ${username}
Temporary Password: ${password}

IMPORTANT: Please change your password after your first login.

Getting Started:
1. Visit our platform at login.community.com
2. Enter your username and temporary password
3. Set up your new secure password
4. Complete your profile information

Need help? Contact us at support@community.com

Best regards,
Community Platform Team`,
      });

      res.send("Membership approved and credentials sent.");
    } else {
      // Rejection Email Template
      const name = member.name;
      await transporter.sendMail({
        from: `"Community Platform" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Update on Your Membership Application",
        html: `
                  <div style="font-family: 'Arial', sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa;">
                      <!-- Header -->
                      <div style="background-color: #A82400; padding: 30px; text-align: center;">
                          <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Membership Application Update</h1>
                      </div>

                      <!-- Main Content -->
                      <div style="padding: 40px 30px; background-color: #ffffff;">
                          <div style="border-left: 4px solid #A82400; padding-left: 15px; margin-bottom: 30px;">
                              <p style="color: #333; margin: 0; font-size: 16px;">Dear ${
                                name || "Applicant"
                              },</p>
                              <p style="color: #666; margin: 10px 0 0 0;">Thank you for your interest in joining our community.</p>
                          </div>

                          <!-- Status Box -->
                          <div style="background-color: #fee4bd; border-radius: 8px; padding: 25px; margin: 30px 0;">
                              <h2 style="color: #A82400; margin: 0 0 20px 0; font-size: 18px;">Application Status</h2>
                              <p style="color: #666; margin: 0;">
                                  After careful review, we regret to inform you that we are unable to approve your membership application at this time.
                              </p>
                          </div>

                          <!-- Next Steps -->
                          <div style="margin: 30px 0;">
                              <h3 style="color: #A82400; margin-bottom: 20px; font-size: 18px;">Next Steps</h3>
                              <ul style="color: #666; padding-left: 20px;">
                                  <li style="margin-bottom: 15px;">Review our membership criteria on our website</li>
                                  <li style="margin-bottom: 15px;">Consider the areas that could be strengthened</li>
                                  <li style="margin-bottom: 15px;">You're welcome to reapply after 3 months</li>
                              </ul>
                          </div>

                          <!-- Feedback Section -->
                          <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin-top: 30px;">
                              <p style="color: #856404; margin: 0; font-size: 14px;">
                                  For specific feedback about your application, please contact our membership team at 
                                  <a href="mailto:membership@community.com" style="color: #A82400; text-decoration: none;">membership@community.com</a>
                              </p>
                          </div>
                      </div>

                      <!-- Footer -->
                      <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
                          <p style="color: #666; font-size: 12px; margin: 0;">
                              © ${new Date().getFullYear()} Community Platform. All rights reserved.
                          </p>
                      </div>
                  </div>
              `,
        text: `Membership Application Update

Dear ${name || "Applicant"},

Thank you for your interest in joining our community.

After careful review, we regret to inform you that we are unable to approve your membership application at this time.

Next Steps:
- Review our membership criteria
- Consider areas that could be strengthened
- You're welcome to reapply after 3 months

For specific feedback, please contact our membership team at membership@community.com

Best regards,
Community Platform Team`,
      });

      res.send("Membership request rejected.");
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Error processing approval.");
  }
});

module.exports = router;
