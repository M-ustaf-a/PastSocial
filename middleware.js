
const CommunityUser = require( "./models/communityUser" );

module.exports.saveRedirectUrl = (req,res,next)=>{
    if(req.session.redirectUrl){
        res.locals.redirectUrl = req.session.redirectUrl;
    }
    next();
};

module.exports.isLoggedIn = async(req,res,next)=>{
    if(!req.isAuthenticated()){
        req.session.redirectUrl = req.orginalUrl;
        req.flash("error", "You must be login");
        return res.redirect("/admin/login");
    }
    next();
};
module.exports.isAuthenticated = (req,res,next)=>{
    if(req.session.userId){
      return next();
    }
    res.redirect("/admin/login");
};

module.exports.isApproved = async(req,res, next)=>{
    const isapproved = await req.Approval.findOne({email});
    if(isapproved.status){
        next();
    }
    res.redirect(`/community/${id}/main`);
}
// module.exports.isApproved = async(req, res, next)=>{
//     let communityUserId = req.session.communityUserId;
//     const isapproved = await CommunityUser.findById(communityUserId);
//     console.log(isapproved);
//     if(isapproved.status){
//         next();
//     }
// }

module.exports.isCompanyEmployee = async(req,res,next)=>{
    if(req.session.companyEmployeeId){
        return next();
    }
    res.redirect("/companylogin");
}

module.exports.checkCommunity =(communityId)=> async(req,res,next)=>{
   if(req.session.user && req.session.user.communityId === communityId){
     return next();
   }
   res.status(403).send("Access denied!");
}


