// middlewares/sanitize.js
const isBadKey = (key) => key.startsWith('$') || key.includes('.');

function sanitizeInPlace(obj) {
    if (obj === null || typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
        obj.forEach(sanitizeInPlace);
        return obj;
    }

    for (const key of Object.keys(obj)) {
        if (isBadKey(key)) {
            delete obj[key];
            continue;
        }
        if (obj[key] && typeof obj[key] === 'object') {
            sanitizeInPlace(obj[key]);
        }
    }

    return obj;
}

const sanitizeRequest = (req, res, next) => {
    if (req.body) sanitizeInPlace(req.body);
    if (req.params) sanitizeInPlace(req.params);
    if (req.query) sanitizeInPlace(req.query); // mutate keys in place — req.query can't be reassigned on Express 5
    next();
};

export default sanitizeRequest;