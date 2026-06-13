import Joi from "joi";

const passwordField = Joi.string()
.min(8)
.max(128)
.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^])/, "password complexity")
.required()
.messages({
    "string.pattern.name": "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&#^)",
    "string.min": "Password must be atleast 8 characters",
    "string.max": "Password cannot exceed 128 characters",
});

const emailField = Joi.string().email().lowercase().trim().required().messages({
    "string.email": "Please provide a valid email address",
});

const phoneField = Joi.string().pattern(/^\+?[\d\s\-]{10,15}$/).required().messages({
    "string.pattern.base": "please provide a valid phone number",
});

export const registerSchema = Joi.object({
    firstName: Joi.string().min(2).max(50).trim().required().message({
        "string.min": "First name must be at least 2 characters",
        "any.required": "First name is required",
    }),
    lastName: Joi.string().min(2).max(50).trim().required().messages({
        "string.min": "First name must be at least 2 characters",
        "any.required": "First name is required",
    }),
    email: emailField,
    phone: phoneField,
    password: passwordField,
    confirmPassword: Joi.string().valid(Joi.ref("password")).required().messages({
        "any.only": "Passwords do not match",
        "any.required": "Please confirm your password",
    }),
});



export const referenceTokenSchema = Joi.object({refreshToken: Joi.string().required().messages({
    "string.length":"MFA token must be 6 digits",
    "string.pattern.base": "MFA token must be numeric",
}),
});

export const loginSchema = Joi.object({
    email: emailField,
    password: Joi.string().required().messages({
        "any.required": "Password is required",
    }),
    mfaToken: Joi.string().length(6).pattern(/^\d+$/).optional().messages({
        "string.length": "MFA token must be 6 digits",
        "string.pattern.base": "MFA token must be numeric",
    }),
});

export const refreshTokenSchema = Joi.object({
    refreshToken: Joi.string().required().messages({
        "any.required": "Refresh token is required",
    }),
});


export const mfaVerifySchema = Joi.object({
    token: Joi.string().length(6).pattern(/^\d+$/).required().messages({
        "string.length":"MFA token must be 6 digits",
        "string.pattern.base": "MFA token must contain only digits",
        "any.required": "MFA token is required",
    }),
});


export const validate = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body, {
            abortEarly: false,  // Return ALL errors at once, not just the first
            stripUnknown: true, // Remove any fields not in the schema (security)
        });
 
        if (error) {
            const details = error.details.map((d) => ({
                field: d.path.join("."),
                message: d.message,
            }));
 
            return res.status(422).json({
                success: false,
                message: "Validation failed",
                error: {
                    code: "VALIDATION_ERROR",
                    details,
                },
            });
        }
 
        // Replace req.body with the validated + sanitized value
        req.body = value;
        next();
    };
};



