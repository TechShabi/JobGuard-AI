/**
 * Global error handler — never leak infrastructure details to clients.
 * Stack traces, DB hosts, credentials, and filesystem paths stay in logs only.
 */
module.exports = (err, req, res, next) => {
  console.error("Error:", err.message);
  if (err.stack) {
    console.error(err.stack);
  }

  const status = err.status || err.statusCode || 500;

  const safeStatuses = status >= 400 && status < 500;
  const clientMessage =
    safeStatuses && err.message && !looksLikeInfrastructure(err.message)
      ? err.message
      : status === 404
        ? "Not found"
        : status === 403
          ? "Forbidden"
          : status === 401
            ? "Unauthorized"
            : "Internal Server Error";

  return res.status(status).json({
    success: false,
    message: clientMessage,
  });
};

function looksLikeInfrastructure(msg) {
  if (!msg || typeof msg !== "string") return false;
  const lower = msg.toLowerCase();
  return (
    lower.includes("sequelize") ||
    lower.includes("econnrefused") ||
    lower.includes("enotfound") ||
    lower.includes("password") ||
    lower.includes("access denied for user") ||
    lower.includes("mysql") ||
    lower.includes("sqlite") ||
    lower.includes("/home/") ||
    lower.includes("/var/") ||
    lower.includes("node_modules") ||
    lower.includes("at object.") ||
    lower.includes("errno")
  );
}
