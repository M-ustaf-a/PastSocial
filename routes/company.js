const express = require("express");
const router = express.Router();
const Notification = require("../models/notification");
const { isCompanyEmployee } = require( "../middleware" );
const Company = require( "../models/company" );
const bcrypt = require("bcryptjs");


router.get("/companyLogin", (req,res)=>{
    res.render("company/companyLogin.ejs");
});

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
        res.redirect("/companyDashboard")
    } catch (err) {
        console.error(err);
        res.status(500).send("Internal Server Error");
    }
});

router.get("/companyDashboard",isCompanyEmployee, async(req,res)=>{
    const {id} = req.params;
    const notifications = await Notification.find({
        type: 'membership_request',
        isRead: false,
    }).sort({createdAt: -1}).limit(10);

    const unreadCount = await Notification.countDocuments({
        type: 'message_request',
        isRead: false,
    });
    res.render("./company/companyDashboard", {notifications, unreadCount, id});
});


router.get("/companyEmployeeApproval/3fcdbc7c-a72c-474a-bbba-4b7d373f550f", async(req,res)=>{
    res.render("./company/companyApproval");
})

router.post("/companyEmployeeApproval/3fcdbc7c-a72c-474a-bbba-4b7d373f550f", async(req,res)=>{
    try{
        const {password} = req.body.companyApproval;
        const companyEmployee = new Company(req.body.companyApproval);
        const hashedPassword = await bcrypt.hash(password,10);
        companyEmployee.password = hashedPassword;
        await companyEmployee.save();
        console.log(companyEmployee);
        res.send("Application submit");
    }catch(err){
        console.log(err);
    }  
});

module.exports = router;