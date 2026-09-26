const express = require("express");
const cors = require("cors");
const sequelize = require("./src/config/db");
const User = require("./src/models/User");
const authRoutes = require("./src/routes/authRoutes");
const testRoutes = require("./src/routes/testRoutes");
const verifyRoutes = require("./src/routes/verifyRoutes");
const ScanHistory = require("./src/models/ScanHistory");
const path = require("path");
const dashboardRoutes = require("./src/routes/dashboardRoutes");
const ScamReport = require("./src/models/ScamReport");
const reportRoutes = require("./src/routes/reportRoutes");

// ── JobGuard v2 additions ──
const Context = require("./src/models/Context");
const ResumeProfile = require("./src/models/ResumeProfile");
const Resume = require("./src/models/Resume");
const InterviewSession = require("./src/models/InterviewSession");
const contextRoutes = require("./src/routes/contextRoutes");
const resumeRoutes = require("./src/routes/resumeRoutes");
const interviewRoutes = require("./src/routes/interviewRoutes");

// ── Career Growth Membership architecture ──
const CareerActivity = require("./src/models/CareerActivity");
const membershipRoutes = require("./src/routes/membershipRoutes");

// ── Sprint 5: Opportunity Find ──
const OpportunitySearch = require("./src/models/OpportunitySearch");
const SavedOpportunity = require("./src/models/SavedOpportunity");
const opportunityRoutes = require("./src/routes/opportunityRoutes");

// ── Sprint 6: Admin Portal ──
const AdminAuditLog = require("./src/models/AdminAuditLog");
const adminRoutes = require("./src/routes/adminRoutes");
const auth = require("./src/middleware/auth");
const admin = require("./src/middleware/admin");
const { adminLimiter } = require("./src/middleware/rateLimiter");

// ── Admin Panel Evolution: minimal persistent feature flags + announcements ──
const FeatureFlag = require("./src/models/FeatureFlag");
const Announcement = require("./src/models/Announcement");

// ── Sprint 7: Membership + Payments ──
const Subscription = require("./src/models/Subscription");
const PaymentTransaction = require("./src/models/PaymentTransaction");
const ProviderEvent = require("./src/models/ProviderEvent");
const billingRoutes = require("./src/routes/billingRoutes");

// ── Membership + Payments Evolution: paid-interest validation ──
const MembershipInterest = require("./src/models/MembershipInterest");

const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const errorHandler = require("./src/middleware/errorHandler");

require("dotenv").config();

const app = express();

app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000"],

    credentials: true,
  }),
);

app.use(express.json());
app.use(helmet());
app.use(compression());
// Sprint 9 — request logging: verbose in development only.
// Production stays quiet unless LOG_HTTP=true is set explicitly.
if (process.env.NODE_ENV !== "production" || process.env.LOG_HTTP === "true") {
  app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
}

app.use("/api/auth", authRoutes);
app.use("/api/verify/", verifyRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/context", contextRoutes);
app.use("/api/resume", resumeRoutes);
app.use("/api/interview", interviewRoutes);
app.use("/api/membership", membershipRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/opportunity", opportunityRoutes);

// Admin — auth then DB-verified admin role, then rate limit
app.use("/api/admin", auth, admin, adminLimiter, adminRoutes);

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/test", testRoutes);
app.use(errorHandler);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Scam Detector Backend Running",
  });
});

// Sprint 9 — production-safe schema strategy.
// Development may use alter:true for convenience when ALLOW_DB_ALTER is not false.
// Production NEVER runs alter:true on boot (schema drift / lock risk).
// Production relies on pre-applied schema (migrations or prior sync).
const isProd = process.env.NODE_ENV === "production";
const allowAlter =
  !isProd && process.env.ALLOW_DB_ALTER !== "false";

sequelize
  .authenticate()
  .then(() => {
    console.log("MySQL Connected");
    if (isProd) {
      // Verify models load against existing tables; do not mutate schema.
      return sequelize.sync({ alter: false });
    }
    if (allowAlter) {
      console.log("Dev schema sync: alter enabled");
      return sequelize.sync({ alter: true });
    }
    return sequelize.sync({ alter: false });
  })
  .then(() => {
    console.log(isProd ? "Tables verified (no alter)" : "Tables Synced");
  })
  .catch((err) => {
    console.log(err);
  });

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server Running On ${PORT}`);
});
