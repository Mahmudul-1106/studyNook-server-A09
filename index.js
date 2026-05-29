const express = require('express')
const { MongoClient, ServerApiVersion } = require('mongodb');
const dotenv = require('dotenv') 
const cors = require("cors");
dotenv.config()

const app = express()
app.use(cors());
app.use(express.json());

const port = process.env.PORT
const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// 1. Declare the global variable cleanly
let roomsCollection;

async function run() {
  try {
    const db = client.db("studyNook");
    
    // 2. FIXED: Assigned it to the global roomsCollection variable properly (with an 's')
    roomsCollection = db.collection("rooms");

    // GET: Featured Rooms (Home Page)
    app.get("/featured", async (req, res) => {
      try {
        // FIXED: Updated variable reference here
        const result = await roomsCollection.find({})
          .sort({ _id: -1 }) 
          .limit(6)
          .toArray();
        res.json(result)
      } catch (error) {
        console.error("Database Fetch Error:", error);
        res.status(500).json({ error: "Failed get room data" });
      }      
    })

    // GET: All Rooms with Filter Queries
    app.get("/rooms", async (req, res) => {
      try {
        const { search, amenities, maxPrice, floor } = req.query;
        let query = {};

        if (search && search.trim() !== "") {
          query.name = { $regex: search, $options: "i" };
        }

        if (amenities && amenities.trim() !== "") {
          const amenitiesArray = amenities.split(",");
          query.amenities = { $in: amenitiesArray };
        }

        if (maxPrice && maxPrice.trim() !== "") {
          const parsedPrice = Number(maxPrice);
          if (!isNaN(parsedPrice)) {
            query.pricePerHour = { $lte: parsedPrice };
          }
        }

        if (floor && floor.trim() !== "") {
          const parsedFloor = Number(floor);
          if (!isNaN(parsedFloor)) {
            query.floor = parsedFloor;
          }
        }

        console.log("Executed MongoDB Query Profile:", query);

        // FIXED: This will now find and reference the database properly!
        const result = await roomsCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error("Backend catalog query failure:", error);
        res.status(500).send({ 
          message: "Failed to parse database query search conditions.",
          error: error.message 
        });
      }
    });


    // GET: roomDetailsPage, Get Room Details
    app.get("/rooms/:id",  async (req, res) => {
      try{
        const { id } = req.params;

      const result = await roomsCollection.findOne({
        _id: new ObjectId(id),
      });

      res.json(result);
      }catch (error) {
        console.error("Database Fetch Error:", error);
        res.status(500).json({ error: "Failed get room data" });
      } 
     });

    // POST: Add New Room
    app.post("/rooms", async (req, res) => {
      try {
        const roomData = req.body;
        console.log("Incoming room data: ", roomData);
        
        // FIXED: Updated variable reference here
        const result = await roomsCollection.insertOne(roomData); 
        
        res.status(201).json(result);
        console.log('Result', result)
      } catch (error) {
        console.error("Database Insertion Error:", error);
        res.status(500).json({ error: "Failed to insert room data" });
      }
    });

  } finally {
    // Keeps connection alive
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Server is running fine')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
