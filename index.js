require("dotenv").config();
const express = require("express");
const app = express();
const port = process.env.PORT || 3000;
const cors = require("cors");
const cookieParse = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// Middlewares
app.use(cors());
app.use(express.json());
// app.use(cookieParse());

// MongoDB Connection URI
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.w1xw1.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
// Main function for our API
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    // Create database and a collection
    const database = client.db("NewsWavesDB");
    const blogsCollection = database.collection("blogs");
    const commentsCollection = database.collection("comments");

    // Get all blogs (GET Endpoint)
    app.get("/blogs", async (req, res) => {
      // get the breakingNews query
      const isBreakingNews = req.query.breakingNews;
      // Get all specific category news
      const categoryType = req.query.categoryType;
      // Empty query
      let query = {};

      // Check if the breaking news query exist
      if (isBreakingNews) {
        // Add "breakingNews" key-pairs in the query object
        query.breakingNews = true;
      }

      // Check if the categoryType query exist
      if (categoryType) {
        query = {
          category: categoryType,
        };
      }

      // Get expected results
      const result = await blogsCollection.find(query).toArray();
      res.send(result);
    });

    // Get all banner featured blogs
    app.get("/featured-banners", async (req, res) => {
      const result = await blogsCollection.find({ featuredBanner: true }).limit(5).toArray();
      res.send(result);
    });

    // Get all recent blogs
    app.get("/recent-blogs", async (req, res) => {
      const result = await blogsCollection.find().limit(6).toArray();
      res.send(result);
    });

    // Get a specific blog based on id
    app.get("/single-blog/:id", async (req, res) => {
      const postId = req.params.id;
      const query = { _id: new ObjectId(postId) };
      const response = await blogsCollection.findOne(query);
      res.send(response);
    });

    // Post a blog
    app.post(`/add-blog`, async (req, res) => {
      // Get the blog data
      const data = req.body;
      const response = await blogsCollection.insertOne(data);
      res.send(response);
    });

    // Post a Comment
    app.post("/add-comment", async (req, res) => {
      const commentData = req.body;
      const result = await commentsCollection.insertOne(commentData);
      console.log(result);
      res.send(result);
    });

    // Get all comments based on 'specific blog id'
    app.get("/comments/:blogId", async (req, res) => {
      const id = req.params.blogId;
      const query = { blogId: id };
      const result = await commentsCollection.find(query).toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello from the server!");
});

app.listen(port, () => {
  console.log(`Blog app listening on port ${port}`);
});
