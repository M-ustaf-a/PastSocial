if (process.env.NODE_ENV != "production") {
  require("dotenv").config();
}
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const Community = require("./models/community");
const methodOverride = require("method-override");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const ejsMate = require("ejs-mate");
const multer = require("multer");
const {storage} = require("./cloudConfig");
const approvalRoute = require("./routes/admin");
const profileRoute = require("./routes/profile");
const communityApproval = require("./routes/userCommunityApproval");
const communitieRoute = require('./routes/commuities');

// Import chat routes and socket initialization
const { router: chatRoutes } = require("./routes/chat");

const app = express();
const MONGO_URL = process.env.ATLAS;

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

// Home Route
app.get("/", (req, res) => {
  res.render("home.ejs");
});

// // Create New Post(video) for a Specific Community
// app.post(
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
//       req.flash("success", "Post created successfully!");
//       res.redirect(`/community/${communityId}/posts`);
//     } catch (error) {
//       console.error("Post creation error:", error);
//       req.flash("error", "Failed to create post");
//       res.redirect(`/community/${communityId}/posts/new`);
//     }
//   }
// );

// Individual Post Details Route
// app.get("/community/:communityId/posts/:postId", async (req, res) => {
//   const { communityId, postId } = req.params;
//   try {
//     const community = await Community.findById(communityId);
//     const post = await Post.findById(postId);

//     if (!post || !community) {
//       return res.status(404).send("Post or Community not found");
//     }

//     res.render("show.ejs", { post, community });
//   } catch (error) {
//     console.error("Error fetching post details:", error);
//     res.status(500).send("An error occurred");
//   }
// });


//Personal message

app.get("/community/:communityId/personal", async (req, res) => {
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

    res.render("personal.ejs", { community, communityId });
  } catch (error) {
    console.error("Error fetching personal page:", error);
    res.status(500).send("An error occurred while fetching the personal page.");
  }
});


//Group message
app.get("/community/:communityId/group", async (req, res) => {
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
    if (sessionUser.communityId !== communityId) {
      console.log("No matching user for this community");
      return res.redirect(`/community/${communityId}/login`);
    }

    res.render("group.ejs", { community, communityId });
  } catch (error) {
    console.error("Error fetching group page:", error);
    res.status(500).send("An error occurred while fetching the group page.");
  }
});


app.get("/community/:communityId/meeting", async (req, res) => {
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



// Use chat routes
app.use(chatRoutes);
app.use("/", approvalRoute);
app.use("/", profileRoute);
app.use("/", communityApproval);
app.use("/", communitieRoute)

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

