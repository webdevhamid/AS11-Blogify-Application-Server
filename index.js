require("dotenv").config();
const express = require("express");
const app = express();
const port = process.env.PORT || 3000;
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");

const admin = require("firebase-admin");
const decodedKeys = Buffer.from(process.env.FB_SERVICE_KEY, "base64").toString("utf-8");
const serviceAccount = JSON.parse(decodedKeys);

// Middlewares
// Allow requests from frontend (Ex: localhost:5173)
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://blogify-app-a2276.web.app",
      "https://blogify-app-a2276.firebaseapp.com",
      "https://hamid.znsusa.com",
    ],
    credentials: true, // allows cookies
  })
);
app.use(cookieParser());
app.use(express.json());

// Firebase admin initialization for authentication
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

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

// Middleware for verifying JWT cookie
// const verifyToken = (req, res, next) => {
//   // Get the token from cookies
//   const token = req.cookies?.token;

//   // Check if token not exist
//   if (!token) return res.status(401).send({ message: "unauthorized token" });

//   // If token exist, then verify it,
//   jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
//     if (err) return res.status(401).send({ message: "unauthorized token" });

//     // Store the decoded token info in the user object
//     req.user = decoded;

//     // Navigate next to the middleware
//     next();
//   });
// };

// Middleware for verifying firebase token
const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers?.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send({ message: "unauthorized token" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.decoded = decoded;
    next();
  } catch (err) {
    return res.status(401).send({ message: "unauthorized token" });
  }
};

// Main function for our API
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    // Create database and a collection
    const database = client.db("NewsWavesDB");
    const blogsCollection = database.collection("blogs");
    const commentsCollection = database.collection("comments");
    const wishlistsCollection = database.collection("wishlists");

    // Generate a JWT token (POST Endpoint)
    // app.post("/jwt", async (req, res) => {
    //   const { email } = req.body;
    //   // Create a JWT Token
    //   const token = jwt.sign(
    //     { email }, // payload consist with the user email
    //     process.env.SECRET_KEY, // Secret key
    //     {
    //       expiresIn: "1d", // One day / 24 hours
    //     }
    //   );

    //   // Send the token to the browser cookie
    //   res.cookie("token", token, {
    //     httpOnly: true, // Prevent XSS attacks (through JS Accessing)
    //     secure: process.env.NODE_ENV === "production", // required for HTTPS
    //     sameSite: process.env.NODE_ENV === "production" ? "none" : "strict", //  for cross-domain cookies
    //     maxAge: 24 * 60 * 60 * 1000, // 1 day in ms
    //     partitioned: true,
    //   });
    //   res.send({ message: "Token created successfully" });
    // });

    // Clear Cookie
    // app.post("/logout", async (req, res) => {
    //   res.clearCookie("token", {
    //     httpOnly: true, // Prevent XSS attacks (through JS Accessing)
    //     secure: process.env.NODE_ENV === "production", // required for HTTPS
    //     sameSite: process.env.NODE_ENV === "production" ? "none" : "strict", //  for cross-domain cookies
    //     partitioned: true,
    //   });
    //   res.status(200).send({ message: "Cookies cleared successfully" });
    // });

    // Get all blogs (GET Endpoint)
    app.get("/blogs", async (req, res) => {
      // get the breakingNews query
      const isBreakingNews = req.query.breakingNews;
      // Get the category news query
      const categoryType = req.query.categoryType;
      // Get search query
      const searchQuery = req.query.search;
      // Get Featured query
      const featuredQuery = req.query.featured;
      // get limit query
      const limit = parseInt(req.query.limit);
      // get current page number query
      const currentPage = parseInt(req.query.page);

      // Empty query for query options
      let query = {};

      // Check if the featured query exist
      if (featuredQuery) {
        query = {
          // Add "featured" property in the query object
          featured: true,
        };
      }

      // Check if the breaking news query exist
      if (isBreakingNews) {
        // Add "breakingNews" property in the query object
        query = {
          breakingNews: true,
        };
      }

      // Check if the categoryType query exist
      if (categoryType) {
        if (categoryType === "All") {
          // Empty query
          query = {};
        } else {
          // Add "category" property in the query object
          query = {
            category: categoryType,
          };
        }
      }

      // Check if search query exist,
      if (searchQuery) {
        // Add "title" property in the query object
        query = {
          title: {
            $regex: searchQuery,
            $options: "i",
          },
        };
      }

      // Get expected results
      const result = await blogsCollection
        .find(query)
        .skip(currentPage * limit)
        .limit(limit)
        .toArray();
      res.send(result);
    });

    app.get("/total-blogs", async (req, res) => {
      const result = await blogsCollection.estimatedDocumentCount();
      return res.send(result);
    });

    // Recent Blogs
    app.get("/recent-posts", async (req, res) => {
      // Get limit query
      const limitQuery = parseInt(req.query.limit);
      // Add "publishedAt" property in the query object
      const query = { publishedAt: -1 };

      // Get expected results
      const result = await blogsCollection.find().sort(query).limit(limitQuery).toArray();
      res.send(result);
    });

    // Update blog
    app.patch("/update-blog/:id", verifyFirebaseToken, async (req, res) => {
      const id = req.params.id;
      const decodedEmail = req.decoded?.email;
      const query = { _id: new ObjectId(id) };
      const updatedData = req.body;
      const email = updatedData?.author?.email;
      const update = {
        $set: updatedData,
      };
      // Check email
      if (decodedEmail !== email) return res.status(403).send({ message: "Forbidden Access" });

      const result = await blogsCollection.updateOne(query, update);
      res.send(result);
    });

    // Get all featured banner blogs
    app.get("/featured-banners", async (req, res) => {
      const result = await blogsCollection.find({ featuredBanner: true }).limit(5).toArray();
      res.send(result);
    });

    // Get a specific blog post based on it's id
    app.get("/single-blog/:id", async (req, res) => {
      try {
        const postId = req.params.id;
        const query = { _id: new ObjectId(postId) };

        const response = await blogsCollection.findOne(query);

        // Validating the post
        if (!response) {
          return res.status(404).send({ success: false, message: "This post no longer exists." });
        }

        res.send(response);
      } catch (err) {
        err;
        res.status(500).send({ success: false, message: "Server error while fetching blog." });
      }
    });

    // Post a blog
    app.post("/add-blog/:email", verifyFirebaseToken, async (req, res) => {
      // Get the blog data
      const data = req.body;
      // Get the decoded user from the token
      const decodedEmail = req.decoded?.email;
      // Get the user email
      const email = req.params.email;

      if (decodedEmail != email) {
        return res.status(403).send({ message: "Forbidden Access" });
      }

      // Send the blog data to blogs collection
      const response = await blogsCollection.insertOne(data);
      res.send(response);
    });

    // Delete a blog
    app.delete("/delete-blog/:email", verifyFirebaseToken, async (req, res) => {
      const { id } = req.body;
      const query = { _id: new ObjectId(id) };
      const decodedEmail = req.decoded?.email;
      const email = req.params.email;

      if (decodedEmail != email) {
        return res.status(403).send({ message: "Forbidden Access" });
      }

      const result = await blogsCollection.deleteOne(query);
      res.send(result);
    });

    // Post a Comment
    app.post("/add-comment", async (req, res) => {
      const commentData = req.body;
      const result = await commentsCollection.insertOne(commentData);
      res.send(result);
    });

    // Get all comments based on 'specific blog id'
    app.get("/comments/:blogId", async (req, res) => {
      const id = req.params.blogId;
      const query = { blogId: id };
      const result = await commentsCollection.find(query).toArray();
      res.send(result);
    });

    // Post a post to wishlist
    app.post("/add-wishlist", async (req, res) => {
      // Get the wishlist data
      const data = req.body;
      const query = { postId: data.postId, userEmail: data.userEmail };

      // Check duplicate wishlist
      const isExisting = await wishlistsCollection.findOne(query);

      if (isExisting) {
        return res.status(400).send({ message: "Item already wishlisted" });
      }

      const result = await wishlistsCollection.insertOne(data);
      res.send(result);
    });

    // Remove a post from wishlist
    app.delete("/remove-wishlist", async (req, res) => {
      const { id } = req.body;
      const query = { postId: id };
      const result = await wishlistsCollection.deleteOne(query);
      res.send(result);
    });

    // Get all wishlists
    app.get("/wishlists/:email", verifyFirebaseToken, async (req, res) => {
      const email = req.params.email;
      const decodedEmail = req.decoded?.email;
      const query = { userEmail: email };

      if (email !== decodedEmail) {
        return res.status(401).send({ message: "unauthorized token" });
      }

      const result = await wishlistsCollection.find(query).toArray();
      res.send(result);
    });

    // Check if a post is wishListed
    app.get("/wishlist/:postId", verifyFirebaseToken, async (req, res) => {
      const id = req.params.postId;
      const decodedEmail = req.decoded?.email;
      const query = { userEmail: decodedEmail, postId: id };

      const exists = await wishlistsCollection.findOne(query);
      // !!exists converts forcefully to boolean. true || false
      res.send({ exists: !!exists });
    });

    // My Blogs endpoint
    app.get("/my-blogs/:email", verifyFirebaseToken, async (req, res) => {
      const email = req.params.email;
      const query = {
        "author.email": email,
      };
      const decodedEmail = req.decoded?.email;
      if (decodedEmail !== email) {
        return res.status(403).send({ message: "Forbidden Access" });
      }
      const result = await blogsCollection.find(query).toArray();
      res.send(result);
    });

    // Featured Blogs based on word length
    app.get("/featured-blogs", async (req, res) => {
      const result = await blogsCollection.find().toArray();

      // Aggregate data based on wordCount property
      for (const post of result) {
        post.wordLength = post.description.length;
      }

      const top10Posts = result.sort((a, b) => b.wordLength - a.wordLength).slice(0, 10);

      res.send(top10Posts);
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // ("Pinged your deployment. You successfully connected to MongoDB!");
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
  `Blog app listening on port ${port}`;
});
