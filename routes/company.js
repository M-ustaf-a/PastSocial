const express = require("express");
const router = express.Router();
const Notification = require("../models/notification");
const { isCompanyEmployee } = require( "../middleware" );
const Company = require( "../models/company" );

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
        const companyEmployee = new Company(req.body.companyApproval);
        await companyEmployee.save();
        res.send("Application submit");
    }catch(err){
        console.log(err);
    }
    
});

router.get("/companyLogin", (req,res)=>{
    res.render("company/companyLogin.ejs");
});

router.post("/companyLogin", async(req,res)=>{
    const { email, password } = req.body;
    try{
        const companyEmployee = await Company.findOne({email});
        console.log(companyEmployee);
    }catch(err){
        console.log(err);
    }
})

router.post("/companydashboard", (req,res)=>{
    res.redirect("/comm")
})

module.exports = router;