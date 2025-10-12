const express = require("express");
const app = express();
const port = process.env.PORT || 3000;
const cors = require("cors");

// Middlewares
app.use(cors());

app.get("/", (req, res) => {
  res.send("Hello from the server!");
});

app.listen(port, () => {
  console.log(`Blog app listening on port ${port}`);
});
