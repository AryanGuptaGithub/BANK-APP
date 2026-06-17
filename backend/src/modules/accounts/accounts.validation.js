// accounts.validation.js 
import Joi from "joi";

// ─── Create Account ────────────────────────────────────────────────────────
export const createAccountSchema = Joi.object({
    accountType: Joi.string()
        .valid("savings", "current", "fixed_deposit")
        .default("savings")
        .messages({
            "any.only": "Account type must be savings, current, or fixed_deposit",
        }),
    currency: Joi.string()
        .length(3)
        .uppercase()
        .default("INR")
        .messages({
            "string.length": "Currency must be a 3-letter code (e.g. INR, USD)",
        }),
    nickname: Joi.string().max(30).optional().messages({
        "string.max": "Nickname cannot exceed 30 characters",
    }),
});

// ─── Freeze / Unfreeze (admin only) ───────────────────────────────────────
export const updateStatusSchema = Joi.object({
    status: Joi.string()
        .valid("active", "frozen", "closed")
        .required()
        .messages({
            "any.only": "Status must be active, frozen, or closed",
            "any.required": "Status is required",
        }),
    reason: Joi.string().max(200).optional(),
});

// ─── Statement query params ────────────────────────────────────────────────
export const statementQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    from: Joi.date().iso().optional(),
    to: Joi.date().iso().min(Joi.ref("from")).optional().messages({
        "date.min": "End date must be after start date",
    }),
});

// ─── Validate middleware ───────────────────────────────────────────────────
export const validate = (schema, source = "body") => {
    return (req, res, next) => {
        const target = source === "query" ? req.query : req.body;

        const { error, value } = schema.validate(target, {
            abortEarly: false,
            stripUnknown: true,
        });

        if (error) {
            const details = error.details.map((d) => ({
                field: d.path.join("."),
                message: d.message,
            }));
            return res.status(422).json({
                success: false,
                message: "Validation failed",
                error: { code: "VALIDATION_ERROR", details },
            });
        }

        // Attach validated value back to correct source
       if (source === "query") req.validatedQuery = value;
        else req.body = value;

        next();
    };
};