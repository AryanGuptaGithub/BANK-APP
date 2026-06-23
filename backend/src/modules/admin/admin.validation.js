import Joi from "joi";

export const listUsersSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    role: Joi.string().valid("customer", "admin", "auditor").optional(),
    kycStatus: Joi.string().valid("pending", "submitted", "approved", "rejected").optional(),
    isActive: Joi.boolean().optional(),
    search: Joi.string().max(100).optional(), // search by name/email
});

export const updateUserStatusSchema = Joi.object({
    isActive: Joi.boolean().required().messages({
        "any.required": "isActive is required",
    }),
    reason: Joi.string().max(200).optional(),
});

export const listAccountsSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    status: Joi.string().valid("active", "frozen", "closed").optional(),
    accountType: Joi.string().valid("savings", "current", "fixed_deposit").optional(),
});

export const listTransactionsSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    type: Joi.string().valid("transfer", "deposit", "withdrawal").optional(),
    status: Joi.string().valid("pending", "completed", "failed").optional(),
    minAmount: Joi.number().positive().optional(),
    from: Joi.date().iso().optional(),
    to: Joi.date().iso().min(Joi.ref("from")).optional(),
});

// ─── Shared validate middleware ────────────────────────────────────────────
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

        if (source === "query") req.validatedQuery = value;
        else req.body = value;

        next();
    };
};