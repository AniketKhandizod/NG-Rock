const express = require("express");
const dataController = require("../controllers/dataController");
const bearerAuth = require("../middleware/bearerAuth");

const router = express.Router();

router.use(bearerAuth);

/**
 * Static paths before `/:index` (otherwise "all", "latest" match as ids).
 * DELETE / is delete-all; GET / is list indexes; GET /all, GET /latest, etc.
 */
router.get("/latest", dataController.getLatestIndex);
router.delete("/", dataController.deleteAllData);
router.get("/", dataController.listIndexes);
router.get("/all", dataController.getAllRecords);

router.post("/", dataController.createRecord);

router.get("/:index", dataController.getOne);
router.put("/:index", dataController.updateRecord);
router.delete("/:index", dataController.deleteRecord);

module.exports = router;
