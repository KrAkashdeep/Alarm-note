const mongoose = require("mongoose");
const url = process.env.MONGODB_URI;

mongoose
  .connect(url)
  .then(() => {
    console.log("MongoDB connected");
  })
  .catch((err) => {
    console.log(err);
  });
