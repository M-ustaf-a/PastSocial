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
const companyRoute = require("./routes/company");

// Import chat routes and socket initialization
const { router: chatRoutes } = require("./routes/chat");
const CommunityData = require( "./models/communityData" );

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
app.get("/community/bot", async(req,res)=>{
  try{
    res.render("bot.ejs");
  }catch(err){
    console.log(err);
  }
})

app.get("/bot", async(req,res)=>{
  try{
    const community = req.query.community;
    console.log(community);
    if(!community){
      return res.send(400).json({error:'community parameter is required'});
    }
    const doc = await CommunityData.findOne({community});
    if(!doc){
      return res.send(400).json({error: `No data found for ${community}`})
    }
    const botResponse = `Welcome to the ${community} community! Here is some information: ${doc.info}`;
    
    // const prompt = `Based solely on the following community information, provide a response:\n\nCommunity Information:\n${doc.info}\n\nResponse:`;
    // const response = await axios.post(
    //   'https://api.openai.com/v1/engines/text-davinci-003/completions',
    //   {
    //     prompt: prompt,
    //     max_tokens: 150,
    //     temperature: 0.7,
    //     n: 1,
    //     stop: ['\n']
    //   },
    //   {
    //     headers: {
    //       'Content-Type': 'application/json',
    //       Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    //     }
    //   }
    // );
    // const botResponse = response.data.choices[0].text.trim();
    res.json({answer: botResponse});
  }catch(err){
    console.log(err);
  }
})
 

// Use chat routes
app.use(chatRoutes);
app.use("/", approvalRoute);
app.use("/", profileRoute);
app.use("/", communityApproval);
app.use("/", communitieRoute);
app.use("/", companyRoute);

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

