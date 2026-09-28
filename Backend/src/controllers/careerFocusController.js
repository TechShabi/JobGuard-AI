const careerFocusService = require("../services/careerFocusService");

// GET /api/career-focus
exports.list = async (req, res) => {
  try {
    const focuses = await careerFocusService.listFocuses(req.user.id);
    return res.json({
      success: true,
      data: {
        focuses,
        limit: careerFocusService.limitFor(req.user),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/career-focus/active
exports.getActive = async (req, res) => {
  try {
    const focus = await careerFocusService.getActiveFocus(req.user.id);
    return res.json({ success: true, data: { focus } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/career-focus
// Body: { name, target_role?, skills?, location?, work_mode?, experience_level? }
exports.create = async (req, res) => {
  try {
    const result = await careerFocusService.createFocus(req.user, req.body || {});
    if (!result.ok) {
      const status = result.reason === "name_required" ? 400 : 403;
      return res.status(status).json({
        success: false,
        message: result.message || "Could not create Career Focus.",
        reason: result.reason,
        limit: result.limit ?? null,
      });
    }
    return res.status(201).json({ success: true, data: { focus: result.focus } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/career-focus/:id
exports.update = async (req, res) => {
  try {
    const result = await careerFocusService.updateFocus(req.user, req.params.id, req.body || {});
    if (!result.ok) {
      return res.status(404).json({ success: false, message: "Career Focus not found." });
    }
    return res.json({ success: true, data: { focus: result.focus } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/career-focus/:id/activate — switch active focus (Pro: adds to
// the active set; Starter/Go: only meaningful when re-activating an
// archived focus, still subject to the 1-focus limit).
exports.activate = async (req, res) => {
  try {
    const result = await careerFocusService.activateFocus(req.user, req.params.id);
    if (!result.ok) {
      const status = result.reason === "not_found" ? 404 : 403;
      return res.status(status).json({
        success: false,
        message: result.message || "Could not activate Career Focus.",
        reason: result.reason,
        limit: result.limit ?? null,
      });
    }
    return res.json({ success: true, data: { focus: result.focus } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/career-focus/:id/archive
exports.archive = async (req, res) => {
  try {
    const result = await careerFocusService.archiveFocus(req.user, req.params.id);
    if (!result.ok) {
      return res.status(404).json({ success: false, message: "Career Focus not found." });
    }
    return res.json({ success: true, data: { focus: result.focus } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/career-focus/:id
exports.remove = async (req, res) => {
  try {
    const result = await careerFocusService.deleteFocus(req.user, req.params.id);
    if (!result.ok) {
      return res.status(404).json({ success: false, message: "Career Focus not found." });
    }
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
