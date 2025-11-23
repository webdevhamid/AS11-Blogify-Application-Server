const fs = require("fs");
const key = fs.readFileSync("./firebase-admin-sdk-key.json", "utf-8");
const base64String = Buffer.from(key).toString("base64");
