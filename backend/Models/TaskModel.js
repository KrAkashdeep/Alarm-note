const mongoose = require("mongoose");

const schema = mongoose.Schema;

const TaskSchema = new schema({
  text: {
    type: String,
    required: true,
  },
  time: {
    type: String,
    required: true,
  },
  completed: {
    type: Boolean,
    default: false,
  },
});

module.exports = mongoose.model("Task", TaskSchema);
