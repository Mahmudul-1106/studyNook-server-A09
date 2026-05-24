const express = require('express')
const { MongoClient, ServerApiVersion } = require('mongodb');
const dotenv = require('dotenv') // call dotenv
const cors = require("cors");
dotenv.config()

const app = express()
app.use(cors());
app.use(express.json());



const port = process.env.PORT
const uri = process.env.MONGODB_URI;;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {

    const db = client.db("studyNook");
    const roomCollection = db.collection("rooms");

    app.get("/featured", async (req, res) => {
      //note: Sort by _id descending (-1) to get the most recently created documents first
      try{const result = await roomCollection.find({})
      .sort({ _id: -1 }) 
      .limit(6)
      .toArray();
      res.json(result)}
      catch (error){console.error("Database Insertion Error:", error);
    res.status(500).json({ error: "Failed get room data" });}

      
    })

    app.post("/rooms", async (req, res) => {
  try {
    const roomData = req.body;
    console.log("Incoming room data: ", roomData);
    
    const result = await roomCollection.insertOne(roomData); 
    
    res.status(201).json(result);
    console.log('Result', result)
  } catch (error) {
    console.error("Database Insertion Error:", error);
    res.status(500).json({ error: "Failed to insert room data" });
  }
});
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Server is running fine')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})


