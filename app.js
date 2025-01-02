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

// Import chat routes and socket initialization
const { router: chatRoutes, initializeSocket } = require("./routes/chat");
const uploadPost = require("./models/uploadPost");
const { isLoggedIn, isApproved } = require("./middleware");
const User = require("./models/user");
const Approvaladmin = require("./models/adminApproval");
const CommunityUser = require( "./models/communityUser" );

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
    store: MongoStore.create({mongoUrl: process.env.ATLAS}),
    cookie: { maxAge: 1000 * 60 * 60 *24 * 7},
  })
);


//Middleware to check authentication
const isAuthenticated = (req,res,next)=>{
  if(req.session.userId){
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

app.get("/createCommunity",isAuthenticated, (req, res) => {
  res.render("commForm");
});

// Create New Community
app.post(
  "/communityForm",
  isAuthenticated,
  upload.single("community[thumbnail]"),
  async (req, res) => {
    try {
      const url = req.file.path;
      const filename = req.file.filename;
      const newCommunity = new Community(req.body.community);

      newCommunity.thumbnail = { url: url, filename: filename };
      await newCommunity.save();

      res.redirect("/community");
    } catch (error) {
      console.error("Community creation error:", error);
      res.redirect("/commForm");
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
    console.log("Route Parameter (communityId):", communityId);

    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).send("Community not found");
    }

    const newUploadPost = await uploadPost.find({ community: communityId });

    const communityid = req.session.user?.communityId; // Access the communityId from session.user
    console.log("Session Data (req.session.user.communityId):", communityid);

    let user = null;
    if (communityid === communityId) {
      user = await CommunityUser.findOne({communityId})
      console.log("User Found:", user);
    } else {
      console.log("No matching user for this community");
    }

    res.render("main.ejs", { community, newUploadPost, user });
  } catch (error) {
    console.error("Error in /community/:communityId/main:", error);
    res.status(500).send("Server error");
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
  const { communityId } = req.params;
  const community = await Community.findById(communityId);
  if (!community) {
    return res.status(404).send("community not found");
  }
  res.render("link.ejs", { community });
});

app.get("/community/:communityId/video", async (req, res) => {
  const { communityId } = req.params;
  try {
    // Find the specific community
    const currentCommunity = await Community.findById(communityId);

    // Find posts specific to this community
    const communityPosts = await Post.find({ community: communityId });

    res.render("community-posts.ejs", {
      community: currentCommunity,
      posts: communityPosts,
    });
  } catch (error) {
    console.error("Error fetching community posts:", error);
    res.status(500).send("An error occurred while fetching community posts");
  }
});

app.get("/community/:communityId/group", async (req, res) => {
  const { communityId } = req.params;
  const community = await Community.findById(communityId);
  if (!community) {
    return res.status(404).send("community not found");
  }
  res.render("group.ejs", { community, communityId });
});
app.get("/community/:communityId/personal", async (req, res) => {
  const { communityId } = req.params;
  const community = await Community.findById(communityId);
  if (!community) {
    return res.status(404).send("community not found");
  }
  res.render("personal.ejs", { community, communityId });
});

app.get("/community/:communityId/meeting", async (req, res) => {
  const { communityId } = req.params;
  const community = await Community.findById(communityId);
  if (!community) {
    return res.status(404).send("community not found");
  }
  res.render("meeting.ejs", { community, communityId });
});

app.get("/community/:communityId/notification", async (req, res) => {
  const { communityId } = req.params;
  const community = await Community.findById(communityId);
  if (!community) {
    return res.status(404).send("community not found");
  }
  res.render("notification.ejs", { community });
});

app.get("/community/:communityId/company", async (req, res) => {
  const { communityId } = req.params;
  const community = await Community.findById(communityId);
  if (!community) {
    return res.status(404).send("community not found");
  }
  res.render("company.ejs", { community });
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

module.exports = app;