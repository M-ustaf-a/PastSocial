const LocalStrategy = require('passport-local').Strategy;
const User = require("../models/user");

function initialize(passport){
    passport.use(new LocalStrategy({usernameField: 'email'}, async(email, password, done)=>{
        try{
            const user = await User.findOne({email:email});
            if(!user){
                return done(null,false, {message: "No user with that email"});
            }
            const isValid = await user.isValidPassword(password); 

            if(isValid){
                return done(null, user);
            }else{
                return done(null, false, {message: "Incorrect password"})
            }
        }catch(err){
            return done(err);
        }
    }));

    passport.serializeUser((user, done)=>{
        done(null, user.id);
    });

    passport.deserializeUser(async(id,done)=>{
        try{
            const user = await User.findById(id);
            done(null, user);
        }catch(err){
            done(err);
        }
    });
}

module.exports = initialize;