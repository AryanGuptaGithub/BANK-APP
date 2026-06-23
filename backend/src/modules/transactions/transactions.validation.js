import Joi from "joi";

// ─── Transfer ───────────────────────────────────────────────────────────
export const transferSchema = Joi.object({
    fromAccountId: Joi.string().hex().length(24).required().messages({
        "string.hex": "Invalid account ID format",
        "string.length": "Invalid account ID format",
        "any.required": "Source account is required",
    }),
    toAccountId: Joi.string().hex().length(24).required().messages({
        "string.hex": "Invalid account ID format",
        "string.length": "Invalid account ID format",
        "any.required": "Destination account is required",
    }),
    amount: Joi.number().positive().precision(2).required().messages({
        "number.positive": "Amount must be greater than 0",
        "any.required": "Amount is required",
    }),
    description: Joi.string().max(200).optional().allow(""),
    idempotencyKey: Joi.string().uuid().required().messages({
        "string.uuid": "Idempotency key must be a valid UUID",
        "any.required": "Idempotency key is required",
    }),
})
    // Prevent transferring to the same account
    .custom((value, helpers) => {
        if (value.fromAccountId === value.toAccountId) {
            return helpers.error("any.invalid", { message: "Cannot transfer to the same account" });
        }
        return value;
    })
    .messages({
        "any.invalid": "Source and destination accounts cannot be the same",
    });

// ─── Deposit ────────────────────────────────────────────────────────────
export const depositSchema = Joi.object({
    toAccountId: Joi.string().hex().length(24).required().messages({
        "any.required": "Destination account is required",
    }),
    amount: Joi.number().positive().precision(2).required().messages({
        "number.positive": "Amount must be greater than 0",
        "any.required": "Amount is required",
    }),
    description: Joi.string().max(200).optional().allow(""),
    idempotencyKey: Joi.string().uuid().required().messages({
        "string.uuid": "Idempotency key must be a valid UUID",
        "any.required": "Idempotency key is required",
    }),
});

// ─── List query params ─────────────────────────────────────────────────
export const listQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    accountId: Joi.string().hex().length(24).optional(),
    type: Joi.string().valid("transfer", "deposit", "withdrawal").optional(),
    status: Joi.string().valid("pending", "completed", "failed").optional(),
    from: Joi.date().iso().optional(),
    to: Joi.date().iso().min(Joi.ref("from")).optional(),
});

// ─── Validate middleware (body or query) ──────────────────────────────────
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