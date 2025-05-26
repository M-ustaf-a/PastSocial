const express = require("express");
const Approvaladmin = require("../models/userApproval");
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

router.get("/userlogin", (req, res) => {
  res.render("user/login.ejs");
});

// router.post("/userlogin", async (req, res) => {
//   const { useremail, userpassword } = req.body;
//   console.log("Email:", useremail, "Password:", userpassword);
  
//   try {
//     const user = await User.findOne({ useremail });
//     console.log("User found:", user);
    
//     if (!user) {
//       return res.render("user/login", { error: "Invalid email or password" });
//     }

//     const isMatch = await bcrypt.compare(userpassword, user.password); // assuming the field in DB is 'password'
//     console.log("Password match:", isMatch);

//     if (!isMatch) {
//       return res.render("user/login", { error: "Invalid email or password" });
//     }

//     // Save user ID to session
//     req.session.userId = user._id;

//     // Redirect to /community after successful login
//     res.redirect("/community");

//   } catch (err) {
//     console.error("Error during login:", err);
//     res.render("user/login", {
//       error: "An error occurred. Please try again later.",
//     });
//   }
// });

router.post("/userlogin", async (req, res) => {
  const { email, password } = req.body;

  // Check if required fields are present
  if (!email || !password) {
    return res.render("user/login", { error: "Email and password are required." });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.render("user/login", { error: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.render("user/login", { error: "Invalid email or password" });
    }

    req.session.userId = user._id;
    res.redirect("/community");
  } catch (err) {
    console.error("Login error:", err);
    res.render("user/login", { error: "An error occurred. Please try again later." });
  }
});

// router.post("/userlogin", async(req,res)=>{
//   const {email,password} = req.body;
//   console.log(email,password);
// })
router.get("/userlogout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error during logout:", err);
      res.redirect("/community");
    }
    res.clearCookie("connect.sid");
    res.redirect("/user/login");
  });
});

// router.get("/admin/profile", isAuthenticated, async (req, res) => {
//   try {
//     const id = req.session.userId; // User ID from session
//     const user = await User.findById(id); // Find the user
//     if (!user) {
//       return res.status(404).send("User not found");
//     }
    
//     const communities = await Community.find({ owner: id }); // Filter communities by owner

//     // Render profile with user and their communities
//     res.render("admin/profile", { user, communities });
//   } catch (error) {
//     console.error(error);
//     res.status(500).send("Internal server error");
//   }
// });

// Get the approval for the create the communities.
router.get("/userapproval", (req, res) => {
  res.render("user/approvalForm");
});

router.post("/userapproval", upload.single("approval[image]"), async (req, res) => {
  try {
    // Check if request body and approval data exist
    if (!req.body || !req.body.approval) {
      return res.status(400).json({ error: "Invalid request format. Missing approval data." });
    }

    // Extract approval data from request body
    const { name, email, bio, role, company, reason } = req.body.approval;
    
    // Validate required fields
    if (!name || !email || !bio || !role || !req.file) {
      return res.status(400).json({ error: "All required fields must be provided, including an image." });
    }
    
    // Get uploaded file information - ensure filename and path are defined
    if (!req.file.path || !req.file.filename) {
      return res.status(400).json({ error: "File upload failed. Missing file information." });
    }
    
    const { path: url, filename } = req.file;
    
    // Create and save new approval request
    const newRequest = new Approvaladmin({
      name,
      email,
      bio,
      role,
      company: company || "", // Handle optional field
      reason: reason || "", // Handle optional field
      image: { url, filename },
      approved: false,
      submittedAt: new Date(),
    });
    
    // Validate model before saving
    const validationError = newRequest.validateSync();
    if (validationError) {
      return res.status(400).json({ error: "Validation failed", details: validationError.message });
    }
    
    const savedRequest = await newRequest.save();
    
    // Create notification with proper error handling
    try {
      await Notification.create({
        type: "membership_request",
        content: {
          requestId: savedRequest._id,
          name,
          email,
          bio,
          role,
          company: company || "",
          imageUrl: url,
          approved: false,
        },
        createdAt: new Date(),
        read: false,
      });
    } catch (notificationErr) {
      console.error("Failed to create notification:", notificationErr);
      // Continue execution - notification failure shouldn't stop the process
    }
    
    // Sanitize and validate email template variables
    const sanitizedName = name.replace(/[<>]/g, '');
    const adminUrl = process.env.ADMIN_URL || '';
    
    // Email HTML template (simplified for brevity)
    const emailHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Membership Request</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    
    :root {
      --primary-color: #2563eb;
      --primary-dark: #1e40af;
      --accent-color: #f0f9ff;
      --text-color: #1f2937;
      --text-light: #6b7280;
      --border-radius: 8px;
      --box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Inter', sans-serif;
      background-color: #f3f4f6;
      color: var(--text-color);
      line-height: 1.6;
      padding: 20px;
    }
    
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: white;
      border-radius: var(--border-radius);
      overflow: hidden;
      box-shadow: var(--box-shadow);
    }
    
    .email-header {
      background-color: var(--primary-color);
      padding: 30px;
      text-align: center;
      color: white;
    }
    
    .badge {
      display: inline-block;
      background-color: rgba(255, 255, 255, 0.2);
      padding: 5px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 500;
      margin-bottom: 12px;
      letter-spacing: 0.5px;
    }
    
    .email-header h1 {
      font-size: 24px;
      font-weight: 700;
      margin: 0;
    }
    
    .email-body {
      padding: 30px;
    }
    
    .intro-text {
      margin-bottom: 25px;
      font-size: 16px;
    }
    
    .applicant-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 30px;
    }
    
    .info-box {
      background-color: var(--accent-color);
      border-radius: var(--border-radius);
      padding: 20px;
      position: relative;
      border-left: 4px solid var(--primary-color);
    }
    
    .info-label {
      font-size: 12px;
      text-transform: uppercase;
      color: var(--primary-color);
      font-weight: 600;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .info-label svg {
      width: 16px;
      height: 16px;
    }
    
    .info-value {
      font-size: 16px;
      font-weight: 500;
      word-break: break-word;
    }
    
    .email-footer {
      background-color: #f9fafb;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
    }
    
    .timestamp {
      font-size: 14px;
      color: var(--text-light);
      margin-bottom: 20px;
      display: block;
    }
    
    .action-button {
      display: inline-block;
      background-color: var(--primary-color);
      color: white;
      text-decoration: none;
      padding: 12px 25px;
      border-radius: var(--border-radius);
      font-weight: 600;
      font-size: 15px;
      transition: all 0.2s ease;
    }
    
    .action-button:hover {
      background-color: var(--primary-dark);
      transform: translateY(-2px);
    }
    
    .notice {
      margin-top: 25px;
      font-size: 12px;
      color: var(--text-light);
      border-top: 1px solid #e5e7eb;
      padding-top: 15px;
    }
    
    @media (max-width: 600px) {
      .applicant-grid {
        grid-template-columns: 1fr;
      }
      
      .email-header, .email-body, .email-footer {
        padding: 20px;
      }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <span class="badge">NEW REQUEST</span>
      <h1>Membership Application</h1>
    </div>
    
    <div class="email-body">
      <p class="intro-text">You've received a new membership request that requires your review. Here are the applicant details:</p>
      
      <div class="applicant-grid">
        <div class="info-box">
          <div class="info-label">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Name
          </div>
          <div class="info-value">${sanitizedName}</div>
        </div>
        
        <div class="info-box">
          <div class="info-label">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Email
          </div>
          <div class="info-value">${email}</div>
        </div>
        
        <div class="info-box">
          <div class="info-label">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Role
          </div>
          <div class="info-value">${role}</div>
        </div>
        
        <div class="info-box">
          <div class="info-label">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            Company
          </div>
          <div class="info-value">${company || "Not specified"}</div>
        </div>
      </div>
    </div>
    
    <div class="email-footer">
      <span class="timestamp">Request received • Today</span>
      <a href="${adminUrl}/admin/requests/${savedRequest._id}" class="action-button">
        Review Application
      </a>
      <div class="notice">
        This is an automated notification. Please do not reply directly.
      </div>
    </div>
  </div>
</body>
</html>`;
    
    // Send email if configured
    if (process.env.EMAIL_USER && process.env.ADMIN_EMAIL) {
      try {
        await transporter.sendMail({
          from: `Admin Dashboard <${process.env.EMAIL_USER}>`,
          to: process.env.ADMIN_EMAIL,
          subject: "✨ New Membership Request - Action Required",
          html: emailHtml,
          attachments: [
            {
              filename: filename,
              path: url,
              cid: 'applicant-image'
            }
          ]
        });
      } catch (emailErr) {
        console.error("Failed to send email notification:", emailErr);
      }
    }
    
    // Return response based on request type
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(201).json({
        success: true,
        message: "Your membership request has been submitted successfully.",
        requestId: savedRequest._id
      });
    }
    
    return res.render("submit.ejs", {
      status: "success",
      message: "Your membership request has been submitted successfully."
    });
    
  } catch (err) {
    console.error("Error processing membership request:", err);
    
    // Check if response has already been sent
    if (res.headersSent) {
      return console.error("Error occurred after response was sent:", err);
    }
    
    // Handle different response formats
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(500).json({ 
        error: "An error occurred while processing the request.",
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
    
    return res.status(500).render("submit.ejs", {
      status: "error",
      message: "An error occurred while processing your request. Please try again."
    });
  }
});



/**
 * Validates the request data for required fields
 * @param {Object} req - Express request object
 * @throws {Error} Validation error with status code
 */
function validateRequestData(req) {
  // Check if request body and approval data exist
  if (!req.body?.approval) {
    const error = new Error("Invalid request format. Missing approval data.");
    error.statusCode = 400;
    throw error;
  }

  // Extract approval data from request body
  const { name, email, bio, role } = req.body.approval;
  
  // Validate required fields
  if (!name || !email || !bio || !role || !req.file) {
    const error = new Error("All required fields must be provided, including an image.");
    error.statusCode = 400;
    throw error;
  }
  
  // Validate file upload
  if (!req.file.path || !req.file.filename) {
    const error = new Error("File upload failed. Missing file information.");
    error.statusCode = 400;
    throw error;
  }
}

/**
 * Process and save the approval request to the database
 * @param {Object} req - Express request object
 * @returns {Object} Saved approval request document
 * @throws {Error} Database or validation error
 */
async function processApprovalRequest(req) {
  const { name, email, bio, role, company = "", reason = "" } = req.body.approval;
  const { path: url, filename } = req.file;
  
  // Create new approval request
  const newRequest = new Approvaladmin({
    name,
    email,
    bio,
    role,
    company,
    reason,
    image: { url, filename },
    approved: false,
    submittedAt: new Date(),
  });
  
  // Validate model before saving
  const validationError = newRequest.validateSync();
  if (validationError) {
    const error = new Error(`Validation failed: ${validationError.message}`);
    error.statusCode = 400;
    throw error;
  }
  
  // Save to database
  return await newRequest.save();
}

/**
 * Create a notification for the new membership request
 * @param {Object} savedRequest - The saved request document
 */
async function createNotification(savedRequest) {
  try {
    await Notification.create({
      type: "membership_request",
      content: {
        requestId: savedRequest._id,
        name: savedRequest.name,
        email: savedRequest.email,
        bio: savedRequest.bio,
        role: savedRequest.role,
        company: savedRequest.company,
        imageUrl: savedRequest.image.url,
        approved: false,
      },
      createdAt: new Date(),
      read: false,
    });
  } catch (notificationErr) {
    // Log error but continue execution
    console.error("Failed to create notification:", notificationErr);
  }
}

/**
 * Send email notification to admin
 * @param {Object} savedRequest - The saved request document
 * @param {Object} fileInfo - Uploaded file information
 * @returns {Promise<boolean>} - Success status of email delivery
 */
async function sendAdminEmail(savedRequest, fileInfo) {
  // Check if email configuration exists
  if (!isEmailConfigured()) {
    console.log("Email notification skipped: Email not configured");
    return false;
  }
  
  try {
    // Create email content and configuration
    const emailConfig = createEmailConfig(savedRequest, fileInfo);
    
    // Send the email
    const info = await transporter.sendMail(emailConfig);
    
    // Log successful delivery
    console.log(`Email notification sent: ${info.messageId}`);
    return true;
    
  } catch (emailErr) {
    console.error("Failed to send email notification:", emailErr);
    
    // Optional: implement retry logic for transient failures
    if (isTransientError(emailErr)) {
      return await retryEmailSending(savedRequest, fileInfo);
    }
    
    return false;
  }
}

/**
 * Check if email sending is properly configured
 * @returns {boolean} - True if email is configured
 */
function isEmailConfigured() {
  const requiredEnvVars = ['EMAIL_USER', 'ADMIN_EMAIL', 'EMAIL_HOST', 'EMAIL_PORT'];
  return requiredEnvVars.every(varName => !!process.env[varName]);
}

/**
 * Determine if the email error is transient and worth retrying
 * @param {Error} error - The error from email sending attempt
 * @returns {boolean} - True if error is transient
 */
function isTransientError(error) {
  // Common transient error codes that are worth retrying
  const transientErrorCodes = [
    'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ESOCKET'
  ];
  
  return transientErrorCodes.includes(error.code) || 
         error.message.includes('timeout') || 
         error.message.includes('rate limit');
}

/**
 * Retry sending the email with exponential backoff
 * @param {Object} savedRequest - The saved request document
 * @param {Object} fileInfo - Uploaded file information
 * @param {Number} attempt - Current attempt number (defaults to 1)
 * @returns {Promise<boolean>} - Success status of email delivery
 */
async function retryEmailSending(savedRequest, fileInfo, attempt = 1) {
  const maxRetries = 3;
  if (attempt > maxRetries) {
    console.error(`Email sending failed after ${maxRetries} attempts`);
    return false;
  }
  
  // Exponential backoff delay
  const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
  
  console.log(`Retrying email sending in ${delay}ms (attempt ${attempt} of ${maxRetries})`);
  
  return new Promise(resolve => {
    setTimeout(async () => {
      try {
        const emailConfig = createEmailConfig(savedRequest, fileInfo);
        await transporter.sendMail(emailConfig);
        console.log(`Email notification sent successfully on retry ${attempt}`);
        resolve(true);
      } catch (error) {
        if (isTransientError(error) && attempt < maxRetries) {
          resolve(await retryEmailSending(savedRequest, fileInfo, attempt + 1));
        } else {
          console.error(`Email retry ${attempt} failed:`, error);
          resolve(false);
        }
      }
    }, delay);
  });
}

/**
 * Create email configuration with content and attachments
 * @param {Object} request - Approval request data
 * @param {Object} fileInfo - Uploaded file information
 * @returns {Object} - Email configuration object
 */
function createEmailConfig(request, fileInfo) {
  return {
    from: formatSenderAddress(),
    to: getRecipientAddresses(request),
    subject: "✨ New Membership Request - Action Required",
    html: createEmailTemplate(request),
    attachments: createEmailAttachments(fileInfo),
    headers: {
      'X-Priority': '1',
      'X-Request-ID': request._id.toString()
    }
  };
}

/**
 * Format sender email address with proper display name
 * @returns {String} - Formatted sender address
 */
function formatSenderAddress() {
  const senderName = process.env.EMAIL_SENDER_NAME || 'Admin Dashboard';
  return `${senderName} <${process.env.EMAIL_USER}>`;
}

/**
 * Get recipient email addresses (supports multiple admins)
 * @param {Object} request - Approval request data
 * @returns {String|Array} - Recipient email address(es)
 */
function getRecipientAddresses(request) {
  const primaryAdmin = process.env.ADMIN_EMAIL;
  
  // Optional: Send to additional admins based on role
  const additionalAdmins = [];
  if (process.env.ADDITIONAL_ADMINS) {
    try {
      const admins = JSON.parse(process.env.ADDITIONAL_ADMINS);
      additionalAdmins.push(...admins);
    } catch (e) {
      console.warn("Failed to parse ADDITIONAL_ADMINS environment variable");
    }
  }
  
  // Always include primary admin
  if (additionalAdmins.length === 0) {
    return primaryAdmin;
  }
  
  return [primaryAdmin, ...additionalAdmins];
}

/**
 * Create email attachments configuration
 * @param {Object} fileInfo - Uploaded file information
 * @returns {Array} - Array of attachment objects
 */
function createEmailAttachments(fileInfo) {
  const attachments = [
    {
      filename: fileInfo.filename,
      path: fileInfo.path,
      cid: 'applicant-image'
    }
  ];
  
  // Optional: Add logo or other standard attachments
  if (process.env.EMAIL_INCLUDE_LOGO === 'true' && process.env.EMAIL_LOGO_PATH) {
    attachments.push({
      filename: 'logo.png',
      path: process.env.EMAIL_LOGO_PATH,
      cid: 'company-logo'
    });
  }
  
  return attachments;
}

/**
 * Create HTML email template
 * @param {Object} request - Approval request data
 * @returns {String} HTML email content
 */
function createEmailTemplate(request) {
  // Sanitize data to prevent XSS
  const sanitizedData = sanitizeRequestData(request);
  const adminUrl = process.env.ADMIN_URL || '';
  const requestId = request._id;
  
  // Include logo if configured
  const logoHtml = process.env.EMAIL_INCLUDE_LOGO === 'true' ? 
    '<img src="cid:company-logo" alt="Company Logo" style="max-width: 200px; margin-bottom: 20px;">' : '';
  
  return `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Membership Request</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            padding: 20px;
            max-width: 600px;
            margin: 0 auto;
          }
          .header {
            background-color: #f5f5f5;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
          }
          .content {
            background-color: #ffffff;
            padding: 20px;
            border-radius: 5px;
            border: 1px solid #ddd;
          }
          .info-item {
            margin-bottom: 10px;
          }
          .label {
            font-weight: bold;
            margin-right: 5px;
          }
          .action-button {
            display: inline-block;
            background-color: #4a86e8;
            color: white;
            padding: 10px 15px;
            text-decoration: none;
            border-radius: 5px;
            margin-top: 20px;
          }
          .applicant-image {
            max-width: 150px;
            margin: 15px 0;
            border-radius: 5px;
          }
          .footer {
            margin-top: 20px;
            font-size: 12px;
            color: #777;
          }
        </style>
      </head>
      <body>
        <div class="header">
          ${logoHtml}
          <h1>New Membership Request</h1>
        </div>
        
        <div class="content">
          <p>A new membership request has been submitted. Here are the details:</p>
          
          <div class="info-item">
            <span class="label">Name:</span> ${sanitizedData.name}
          </div>
          
          <div class="info-item">
            <span class="label">Email:</span> ${sanitizedData.email}
          </div>
          
          <div class="info-item">
            <span class="label">Role:</span> ${sanitizedData.role}
          </div>
          
          <div class="info-item">
            <span class="label">Company:</span> ${sanitizedData.company}
          </div>
          
          <div class="info-item">
            <span class="label">Submitted:</span> ${formatDate(request.submittedAt)}
          </div>
          
          ${sanitizedData.bio ? `
          <div class="info-item">
            <span class="label">Bio:</span><br>
            ${sanitizedData.bio}
          </div>` : ''}
          
          ${sanitizedData.reason ? `
          <div class="info-item">
            <span class="label">Reason for joining:</span><br>
            ${sanitizedData.reason}
          </div>` : ''}
          
          <img src="cid:applicant-image" alt="Applicant Photo" class="applicant-image">
          
          <a href="${adminUrl}/admin/requests/${requestId}" class="action-button">Review Request</a>
        </div>
        
        <div class="footer">
          <p>This is an automated message. Please do not reply to this email.</p>
          <p>Request ID: ${requestId}</p>
        </div>
      </body>
    </html>`;
}

/**
 * Sanitize request data for email template
 * @param {Object} request - Approval request data
 * @returns {Object} - Sanitized data object
 */
function sanitizeRequestData(request) {
  // Helper function to sanitize strings
  const sanitize = (text) => {
    if (!text) return '';
    return String(text)
      .replace(/[<>]/g, '') // Remove angle brackets to prevent HTML injection
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/`/g, '&#x60;');
  };
  
  // Sanitize all fields
  return {
    name: sanitize(request.name),
    email: sanitize(request.email),
    role: sanitize(request.role),
    company: sanitize(request.company || 'Not specified'),
    bio: sanitize(request.bio),
    reason: sanitize(request.reason)
  };
}

/**
 * Format date for email display
 * @param {Date} date - Date to format
 * @returns {String} - Formatted date string
 */
function formatDate(date) {
  if (!date) return '';
  
  try {
    return new Date(date).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return date.toString();
  }
}

/**
 * Send success response in appropriate format
 * @param {Object} res - Express response object
 * @param {Object} req - Express request object
 * @param {String} requestId - ID of the saved request
 */
function sendSuccessResponse(res, req, requestId) {
  // JSON response for API requests
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(201).json({
      success: true,
      message: "Your membership request has been submitted successfully.",
      requestId
    });
  }
  
  // HTML response for form submissions
  return res.render("submit.ejs", {
    status: "success",
    message: "Your membership request has been submitted successfully."
  });
}

/**
 * Handle errors and send appropriate error response
 * @param {Error} err - The error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
function handleError(err, req, res) {
  // Log the error
  console.error("Error processing membership request:", err);
  
  // Skip if response already sent
  if (res.headersSent) {
    return console.error("Error occurred after response was sent:", err);
  }
  
  // Get status code from error or default to 500
  const statusCode = err.statusCode || 500;
  const errorMessage = err.message || "An error occurred while processing the request.";
  
  // JSON response for API requests
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(statusCode).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
  
  // HTML response for form submissions
  return res.status(statusCode).render("submit.ejs", {
    status: "error",
    message: "An error occurred while processing your request. Please try again."
  });
}

module.exports = router;
