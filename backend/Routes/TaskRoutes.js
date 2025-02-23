const router = require("express").Router();
const {
  getAllTasks,
  createTask,
  editTask,
  deleteTask,
} = require("../Controllers/TaskControllers");

router.get("/", getAllTasks);
router.post("/", createTask);
router.put("/:id", editTask);
router.delete("/:id", deleteTask);

module.exports = router;
