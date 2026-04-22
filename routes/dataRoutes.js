const express = require("express");
const dataController = require("../controllers/dataController");
const apiKeyAuth = require("../middleware/apiKeyAuth");

const router = express.Router();

router.use(apiKeyAuth);

/**
 * Order matters: `/all` must be registered before `/:index` or "all" is parsed as a numeric id.
 */
router.get("/", dataController.listIndexes);
router.get("/all", dataController.getAllRecords);

router.post("/", dataController.createRecord);

router.get("/:index", dataController.getOne);
router.put("/:index", dataController.updateRecord);
router.delete("/:index", dataController.deleteRecord);

module.exports = router;
