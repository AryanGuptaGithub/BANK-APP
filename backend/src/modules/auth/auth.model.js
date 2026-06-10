import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import config from "../../config/env.js";

const userSchema = new mongoose.Schema(
    {
        firstName:{
            type: String,
            required: [true, "First name is required"],
            trim: true,
            minlength: [2, "First name cannot exceed 50 characters"],
            maxlength: [50, "First name cannot exceeed 50 characters"],
        },
        lastName: {
            type: String,
            required: [true, "Last name is required"],
            trim: true,
            minlength: [2, "Last name must be at least 2 charaters"],
            maxlength: [50, "Last name cannot be exceed 50 characters"],
        },
        email:{
            type: String,
            required: [true, "Email is required"],
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^\S+@\S+\.\S+$/, "Please Provide a valid email"],
        },
        phone: {
            type: String,
            required: [true, "Phone number is required"],
            unique: true,
            trim: true,
            match: [/^\+?[\d\s\-]{10,15}$/, "Please provide a valid phone number"],
        },
        password: {
            type: String,
            required: [true, "Password is required"],
            minlength: [8, "Password must be at least 8 characters"],
            select: false,
        },
        role:{
            type: String,
            enum: ["customr", "admin", "auditor"],
            default: "customer",
        },
        isActive:{
            type: Boolean,
            default: true,
        },
        isEmailVerified:{
            type: Boolean,
            default: false,
        },
        emailVerificationToken:{
            type: String,
            select: false,
        },
        emailVerificationExpires:{
            type: Date,
            select: false,
        },
        failedLoginAttempts:{
            type: Number,
            default: 0,
        },
        lockUntill:{
            type: Date,
            default: null,
        },
        passwordResetToken:{
            type: String,
            select: false,
        },
        passwordResetExpires:{
            type: Date,
            select: false,
        },
        passwordChangedAt:{
            type: Date,
        },
        mfaSecret:{
            type: String,
            select: false,
        },
        isMfaEnabled:{
            type: Boolean,
            default: false,
        },
        kycStatus:{
            type: String,
            enum: ["pending", "submitted", "approved", "rejected"],
            default: "pending",
        },
        refreshToken:{
            type: String,
            select: false,
        },
        lastLoginAt:{
            type: Date,
        },
        lastLoginIp:{
            type: String,
        }
    },
    { timestamps: true, }
);



userSchema.virtual("fullname").get(function(){
    return `${this.firstName} ${this.lastName}`;
});

userSchema.virtual("isLocked").get(function(){
    return !!(this.lockUntill && this.lockUntill > Date.now());
});


userSchema.pre("save", async function (next){
    if(!this.isModified("password")) return next();
    this.password = await bcrypt.hash(this.password, config.bcrypt.saltRounds);

    if(!this.isNew){
        this.passwordChangedAt = new Date(Date.now() - 1000);
    }

    next();
});


userSchema.methods.comparePassword = async function (candidatePassword){
    return bcrypt.compare(candidatePassword, this.password);
};

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS = 30 * 60 * 100;

userSchema.methods.incrementFailedAttempts = async function(){
    this.failedLoginAttempts += 1;
    if(this.failedLoginAttempts >= MAX_LOGIN_ATTEMPTS){
        this.lockUntill = new Date(Date.now() + LOCK_DURATION_MS);
    }
    return this.save();
}

userSchema.methods.resetFailedAttempts = async function(){
    this.failedLoginAttempts = 0;
    this.lockUntill = null;
    return this.save;
}

userSchema.methods.wasPasswordChangedAfter = function(jwtIssueAt){
    if(this.passwordChangedAt){
        const changedAtSeconds = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
        return jwtIssueAt < changedAtSeconds;
    }
    return false;
};

userSchema.index({email: 1});
userSchema.index({ phone: 1});

const User = mongoose.model("User", userSchema);

export default User;
