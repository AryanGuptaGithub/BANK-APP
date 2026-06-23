import Joi from "joi";

export const listQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    unreadOnly: Joi.boolean().default(false),
});

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