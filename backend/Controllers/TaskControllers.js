const TaskModel = require("../Models/TaskModel");

// Create a new task
const createTask = async (req, res) => {
  try {
    const task = await TaskModel.create(req.body);
    res
      .status(201)
      .json({ message: "created successfully", success: true, data: task });
  } catch (error) {
    res.status(400).json({
      message: "failed to create task",
      success: false,
      error: error.message,
    });
  }
};

// Get all tasks
const getAllTasks = async (req, res) => {
  try {
    const tasks = await TaskModel.find({});
    res.status(200).json({
      message: "tasks fetched successfully",
      success: true,
      data: tasks,
    });
  } catch (error) {
    res.status(500).json({
      message: "failed to fetch tasks",
      success: false,
      error: error.message,
    });
  }
};

// Edit a task
const editTask = async (req, res) => {
  try {
    const task = await TaskModel.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    res.status(200).json({
      message: "task updated successfully",
      success: true,
      data: task,
    });
  } catch (error) {
    res.status(400).json({
      message: "failed to update task",
      success: false,
      error: error.message,
    });
  }
};

// Delete a task
const deleteTask = async (req, res) => {
  try {
    await TaskModel.findByIdAndDelete(req.params.id);
    res
      .status(200)
      .json({ message: "task deleted successfully", success: true });
  } catch (error) {
    res.status(400).json({
      message: "failed to delete task",
      success: false,
      error: error.message,
    });
  }
};

module.exports = { createTask, getAllTasks, editTask, deleteTask };
