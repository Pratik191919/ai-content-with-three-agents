// Validate that a string is a proper Redis URL before passing to client
// Prevents crashes if someone pastes a CLI command instead of a URL
function isValidRedisUrl(url) {
    if (!url) return false;
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'redis:' || parsed.protocol === 'rediss:';
    } catch {
        return false;
    }
}

module.exports = { isValidRedisUrl };
