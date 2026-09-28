const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const careerFocusController = require("../controllers/careerFocusController");

// Career Focus requires a logged-in account — it is durable, cross-tool
// context (product-spec sections 26-30), unlike the guest-friendly one-off
// tools it informs.
router.get("/", auth, careerFocusController.list);
router.get("/active", auth, careerFocusController.getActive);
router.post("/", auth, careerFocusController.create);
router.patch("/:id", auth, careerFocusController.update);
router.post("/:id/activate", auth, careerFocusController.activate);
router.post("/:id/archive", auth, careerFocusController.archive);
router.delete("/:id", auth, careerFocusController.remove);

module.exports = router;
