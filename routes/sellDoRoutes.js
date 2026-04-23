const express = require("express");
const bearerAuth = require("../middleware/bearerAuth");
const sellDoController = require("../controllers/sellDoController");

const router = express.Router();

router.use(bearerAuth);
router.post("/mark-placed-answered", sellDoController.markPlacedAnswered);

module.exports = router;
