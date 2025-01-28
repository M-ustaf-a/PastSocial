if (process.env.NODE_ENV != "production") {
  require("dotenv").config();
}
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const multer = require("multer");
const { storage } = require("./cloudConfig");
const Post = require("./models/post");
const Community = require("./models/community");
const methodOverride = require("method-override");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const flash = require("connect-flash");
const ejsMate = require("ejs-mate");
const approvalRoute = require("./routes/admin");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const crypto = require("crypto");
const profileRoute = require("./routes/profile");
const communityApproval = require("./routes/userCommunityApproval");
const checkCommunity = require("./middleware");
const checkAdmin = require("./middleware");

// Import chat routes and socket initialization
const { router: chatRoutes, initializeSocket } = require("./routes/chat");
const uploadPost = require("./models/uploadPost");
const { isLoggedIn, isApproved } = require("./middleware");
const User = require("./models/user");
const Approvaladmin = require("./models/adminApproval");
const CommunityUser = require("./models/communityUser");
const Notification = require("./models/notification");
const ApprovalCommunity = require( "./models/approveCommunity" );

const app = express();
const MONGO_URL = process.env.ATLAS;

// Multer configuration for file uploads
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

// Database Connection
mongoose
  .connect(MONGO_URL)
  .then(() => {
    console.log("Connected to the database");
    // Initialize other parts of your app that depend on the database connection
  })
  .catch((err) => {
    console.error("Database connection error:", err);
  });

// Middleware Setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(methodOverride("_method"));
app.engine("ejs", ejsMate);

// Configure session with 1-week expiration
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.ATLAS }),
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 },
  })
);

//Middleware to check authentication
const isAuthenticated = (req, res, next) => {
  if (req.session.userId) {
    return next();
  }
  res.redirect("/admin/login");
};

// Home Route
app.get("/", (req, res) => {
  res.render("home.ejs");
});

// Community Routes
// List all communities
app.get("/community", async (req, res) => {
  try {
    const Communities = await Community.find({});
    const id = req.session.userId;
    const user = await User.findById(id);
    res.render("community.ejs", { Communities, user });
  } catch (error) {
    console.error("Error fetching communities:", error);
    res.status(500).send("An error occurred while fetching communities");
  }
});

app.get("/createCommunity", isAuthenticated, (req, res) => {
  res.render("commForm");
});

// Create New Community
app.post(
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
app.get("/community/:communityId/posts/new", async (req, res) => {
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

// Create New Post(video) for a Specific Community
app.post(
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
      req.flash("success", "Post created successfully!");
      res.redirect(`/community/${communityId}/posts`);
    } catch (error) {
      console.error("Post creation error:", error);
      req.flash("error", "Failed to create post");
      res.redirect(`/community/${communityId}/posts/new`);
    }
  }
);

// Individual Post Details Route
app.get("/community/:communityId/posts/:postId", async (req, res) => {
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

// Suggestion Route
app.post(
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

app.get("/community/:communityId/feeds", async (req, res) => {
  const { communityId } = req.params;
  const community = await Community.findById(communityId);
  const notification = ["notification1"];
  if (!community) {
    return res.status(404).send("Community not found");
  }

  res.render("feeds.ejs", { community, notification });
});

app.get("/community/:communityId/main", async (req, res) => {
  try {
    const { communityId } = req.params;

    // Validate if communityId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(communityId)) {
      return res.status(400).send("Invalid community ID");
    }

    // Retrieve the current user's ID from the session
    const currUserId = req.session?.user?.id;

    // Fetch the current user
    const currUser = await CommunityUser.findById(currUserId);
    console.log(currUser);
    // Fetch the community by ID
    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).send("Community not found");
    }

    // Fetch posts uploaded in the community
    const newUploadPost = await uploadPost.find({ communityId });
    console.log("Fetched Posts:", newUploadPost);

    // Render the main view with the fetched data
    res.render("main", { currUser, community, newUploadPost });
  } catch (error) {
    console.error("Error in /community/:communityId/main:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.post(
  "/community/:communityId/main",
  upload.single("upload[image]"),
  async (req, res) => {
    try {
      // Validate file upload
      if (!req.file) {
        return res.status(400).send("No file uploaded.");
      }

      // Validate session user ID
      const userId = req.session?.user?.id; // Fixed session key structure
      if (!userId) {
        return res.status(401).send("User not authenticated.");
      }

      const { communityId } = req.params;

      // Validate communityId
      if (!communityId || !mongoose.Types.ObjectId.isValid(communityId)) {
        return res.status(400).send("Invalid community ID.");
      }

      const { path: url, filename } = req.file;

      // Find the user by session ID
      const user = await CommunityUser.findById(userId);
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
        user: user._id,
      });
      newUploadPost.user.name = user.name;
      newUploadPost.user.image = user.image;
      await newUploadPost.save();

      // Redirect to the community's main page
      res.redirect(`/community/${communityId}/main`);
    } catch (error) {
      console.error("Error handling post:", error);
      res.status(500).send("An error occurred while processing your request.");
    }
  }
);


app.get("/community/:communityId/link", async (req, res) => {
  try {
    const { communityId } = req.params;

    // Validate if communityId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(communityId)) {
      return res.status(400).send("Invalid community ID");
    }

    // Fetch the community by ID
    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).send("Community not found");
    }

    // Get current user ID from the session
    const currUserId = req.session.user.id;
    if (!mongoose.Types.ObjectId.isValid(currUserId)) {
      console.error("Invalid current user ID in session");
      return res.status(400).send("Invalid session data");
    }

    // Fetch the current user by ID
    const currUser = await CommunityUser.findById(currUserId);

    // Retrieve the current user's community ID from the session
    const sessionCommunityId = req.session.user?.communityId;

    // Fetch all users in the specified community
    const users = await CommunityUser.find({ communityId });

    // Check if the current user belongs to the requested community
    let matchedUser = null;
    if (sessionCommunityId === communityId) {
      matchedUser = users.find(user => user._id.toString() === currUserId);
      console.log("Matched User Found:", matchedUser);
    } else {
      console.log("No matching user for this community");
    }

    // Render the view with the required data
    res.render("link.ejs", {
      community,
      matchedUser,
      users,
      currUser,
    });
  } catch (error) {
    console.error("Error in fetching community data:", error);
    res.status(500).send("Internal Server Error");
  }
});




app.get("/community/:communityId/video", async (req, res) => {
  const { communityId } = req.params;
  try {
    // Find the specific community
    const currentCommunity = await Community.findById(communityId);

    // Find posts specific to this community
    const communityPosts = await Post.find({ community: communityId });
    const communityid = req.session.user?.communityId;
    let user = null;
    if (communityid === communityId) {
      user = await CommunityUser.findOne({ communityId });
      console.log("User Found:", user);
      res.render("community-posts.ejs", {
        community: currentCommunity,
        posts: communityPosts,
        user
      });
    } else {
      console.log("No matching user for this community");
      res.redirect("login")
    }
  } catch (error) {
    console.error("Error fetching community posts:", error);
    res.status(500).send("An error occurred while fetching community posts");
  }
});

app.get("/community/:communityId/group", async (req, res) => {
  const { communityId } = req.params;
  const communityid = req.session.user?.communityId;
  const community = await Community.findById(communityId);
  if (!community) {
    return res.status(404).send("community not found");
  }
  if (communityid === communityId) {
    res.render("group.ejs", { community, communityId });
  } else {
    console.log("No matching user for this community");
    res.redirect("login")
  }
});
app.get("/community/:communityId/personal", async (req, res) => {
  const { communityId } = req.params;
  const communityid = req.session.user?.communityId;
  const community = await Community.findById(communityId);
  if (!community) {
    return res.status(404).send("community not found");
  }
  if (communityid === communityId) {
    res.render("personal.ejs", { community, communityId });
  } else {
    console.log("No matching user for this community");
    res.redirect("login")
  }
});

app.get("/community/:communityId/meeting", async (req, res) => {
  const { communityId } = req.params;
  const community = await Community.findById(communityId);
  const communityid = req.session.user?.communityId;
  if (!community) {
    return res.status(404).send("community not found");
  }
  if (communityid === communityId) {
    res.render("meeting.ejs", { community, communityId });
  } else {
    console.log("No matching user for this community");
    res.redirect("login")
  }
});

app.get("/community/:communityId/notification", async (req, res) => {
  const { communityId } = req.params;
  const community = await Community.findById(communityId);
  const communityid = req.session.user?.communityId; // Access the communityId from session.user
    console.log("Session Data (req.session.user.communityId):", communityid);
    let user = null;
    let users = null;
    if (communityid === communityId) {
      user = await CommunityUser.findOne({ communityId });
      console.log("User Found:", user);
      users = await ApprovalCommunity.find({}).sort({createAt:-1});
      res.render("notification.ejs", { community, users, user });
    } else {
      console.log("No matching user for this community");
      res.redirect( 'login');
    }
});

app.get("/community/:communityId/company", async (req, res) => {
  const { communityId } = req.params;
  const community = await Community.findById(communityId);
  const communityid = req.session.user?.communityId;
  if (!community) {
    return res.status(404).send("community not found");
  }
  let user = null;
    if (communityid === communityId) {
      user = await CommunityUser.findOne({ communityId });
      console.log("User Found:", user);
      res.render("company.ejs", { community, user });
    } else {
      console.log("No matching user for this community");
      res.redirect("login");
    }
});

function ensureAuthenticate(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/admin/login");
}

// Use chat routes
app.use(chatRoutes);
app.use("/", approvalRoute);
app.use("/", profileRoute);
app.use("/", communityApproval);

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

// Start Server
const PORT = process.env.PORT || 8080;
const server = app.listen(PORT, () =>
  console.log(`Server is running on http://localhost:${PORT}`)
);

