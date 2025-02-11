const express = require("express");
const router = express.Router();
const Notification = require("../models/notification");
const { isCompanyEmployee, isCompanyLogged } = require("../middleware");
const Company = require("../models/company");
const bcrypt = require("bcryptjs");

// GET /companyLogin
router.get("/companyLogin", (req, res) => {
    if (req.session.companyEmployeeId) {
        return res.redirect("/companyDashboard");
    }
    return res.render("./company/companyLogin"); // Ensure you have a proper login page
});

// POST /companyLogin
router.post("/companyLogin", async (req, res) => {
    const { employeeId, password } = req.body;

    try {
        const companyEmployee = await Company.findOne({ employeeId });

        if (!companyEmployee) {
            return res.status(404).send("Employee not found");
        }

        const isMatch = await bcrypt.compare(password, companyEmployee.password);

        if (!isMatch) {
            return res.status(403).send("Password is incorrect");
        }

        req.session.companyEmployeeId = companyEmployee._id;
        res.redirect("/companyDashboard");
    } catch (err) {
        console.error(err);
        res.status(500).send("Internal Server Error");
    }
});

// GET /companyLogout
router.get("/companyLogout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.log(err);
            return res.redirect("/companyDashboard");
        }
        res.clearCookie("connect.sid");
        res.redirect("/companyLogin");
    });
});

// GET /companyDashboard
router.get("/companyDashboard", isCompanyEmployee, async (req, res) => {
    try {
        const notifications = await Notification.find({
            type: "membership_request",
            isRead: false,
        })
            .sort({ createdAt: -1 })
            .limit(10);

        const unreadCount = await Notification.countDocuments({
            type: "message_request",
            isRead: false,
        });
        const user = 

        res.render("./company/companyDashboard", { notifications, unreadCount });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error loading dashboard");
    }
});

// GET /companyEmployeeApproval
// router.get("/companyEmployeeApproval/3fcdbc7c-a72c-474a-bbba-4b7d373f550f", (req, res) => {
//     res.render("./company/companyApproval");
// });

// POST /companyEmployeeApproval
// router.post("/companyEmployeeApproval/3fcdbc7c-a72c-474a-bbba-4b7d373f550f", async (req, res) => {
//     try {
//         const { password, ...otherDetails } = req.body;
//         const hashedPassword = await bcrypt.hash(password, 10);

//         const companyEmployee = new Company({
//             ...otherDetails,
//             password: hashedPassword,
//         });

//         await companyEmployee.save();
//         console.log(companyEmployee);
//         res.send("Application submitted successfully");
//     } catch (err) {
//         console.error(err);
//         res.status(500).send("Error processing approval");
//     }
// });

module.exports = router;
