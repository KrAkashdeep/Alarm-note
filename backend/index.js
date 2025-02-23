const express = require("express");
const app = express();
const PORT = 5000;
const bodyParser = require("body-parser");
const taskRoutes = require("./Routes/TaskRoutes");
const cors = require("cors");

require("dotenv").config();
require("./config/db.js");
app.use(bodyParser.json());
// app.use(cors());
app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.get("/", (req, res) => {
  res.send("Hello World");
});
app.use("/tasks", taskRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
