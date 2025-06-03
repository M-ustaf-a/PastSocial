const express = require("express");
const router = express.Router();
const multer = require("multer");

const { storage } = require("../../cloudConfig");
const Community = require("../../models/community");
const Group = require("../../models/group");
const CommunityUser = require("../../models/communityUser")

// Multer config for image/video filtering
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.fieldname === "groupForm[image]") {
      if (file.mimetype.startsWith("image/")) {
        cb(null, true);
      } else {
        cb(new Error("Only image files are allowed!"), false);
      }
    } else if (file.fieldname === "post[video]") {
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

// GET group listing
router.get("/community/:communityId/group", async (req, res) => {
  try {
    const { communityId } = req.params;
    const sessionUser = req.session?.communityUser;

    const community = await Community.findById(communityId);
    const groups = await Group.find({});
    if (!community) {
      return res.status(404).send("Community not found");
    }

    if (!sessionUser) {
      console.log("User not logged in, redirecting to login");
      return res.redirect(`/community/${communityId}/login`);
    }

    if (sessionUser.communityId !== communityId) {
      console.log("No matching user for this community");
      return res.redirect(`/community/${communityId}/login`);
    }
    const currUser = await CommunityUser.findById(sessionUser.id);

    if(!currUser){
      res.status(404).send("User is not found");
    }

    res.render("./discussionRoom/group.ejs", { community, communityId, groups, currUser});
  } catch (error) {
    console.error("Error fetching group page:", error);
    res.status(500).send("An error occurred while fetching the group page.");
  }
});

// GET group creation form
router.get("/community/:communityId/groupForm", async (req, res) => {
  const { communityId } = req.params;
  const community = await Community.findById(communityId)
  res.render("discussionRoom/groupcreateForm", {community, communityId });
});

// POST new group
router.post(
  "/community/:communityId/group",
  upload.single("groupForm[image]"),
  async (req, res) => {
    try {
      if (!req.file) {
        throw new Error("File upload is required");
      }

      const { communityId } = req.params;
      const { path: url, filename } = req.file;

      if (!req.body.groupForm) {
        throw new Error("Form data missing");
      }

      const newGroup = new Group(req.body.groupForm);
      newGroup.image = { url, filename };
      await newGroup.save();

      res.redirect(`/community/${communityId}/group`);
    } catch (err) {
      console.error("Error creating group:", err.message);
      res.status(400).send("An error occurred while creating the group.");
    }
  }
);

//Message Route
router.get("/community/:communityId/groupchat", async(req,res)=>{
  res.render("discussionRoom/groupChat");
});

module.exports = router;
