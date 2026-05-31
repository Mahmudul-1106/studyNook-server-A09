
const express = require('express')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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

let roomsCollection;

async function run() {
  try {
    const db = client.db("studyNook");
    roomsCollection = db.collection("rooms");


    // ==================== API ROUTES ====================

    // GET: Featured Rooms (Home Page)
    app.get("/featured", async (req, res) => {
      try {
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
          if (!isNaN(parsedPrice)) query.pricePerHour = { $lte: parsedPrice };
        }
        if (floor && floor.trim() !== "") {
          const parsedFloor = Number(floor);
          if (!isNaN(parsedFloor)) query.floor = parsedFloor;
        }

        const result = await roomsCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to parse database query search conditions.", error: error.message });
      }
    });

    // GET: Single Room Details Page Node
    app.get("/rooms/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const result = await roomsCollection.findOne({ _id: new ObjectId(id) });
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: "Failed get room data" });
      } 
    });

    // POST: Add New Room
    app.post("/rooms", async (req, res) => {
      try {
        const roomData = req.body;
        roomData.createdAt = new Date(); 
        roomData.bookingCount = 0; 
        
        const result = await roomsCollection.insertOne(roomData); 
        res.status(201).json(result);
      } catch (error) {
        console.error("Database Insertion Error:", error);
        res.status(500).json({ error: "Failed to insert room data" });
      }
    });

    // PATCH: Increment Booking Counter
    app.patch("/rooms/:id/book", async (req, res) => {
      try {
        const { id } = req.params;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $inc: { bookingCount: 1 } 
        };
        const result = await roomsCollection.updateOne(filter, updateDoc);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: "Failed to process room booking incrementation step" });
      }
    });

    // Delet Room
    app.delete("/rooms/:id", async (req, res) => {
      const { id } = req.params;
      const result = await roomsCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.json(result);
    });

  } finally {
    // Keeps connection alive
  }
}

// 🔥 FIXED: Called run() cleanly without breaking the parentheses chain
run().catch(console.dir);

app.get('/', (req, res) => { res.send('Server is running fine') })

app.listen(port, () => { console.log(`Example app listening on port ${port}`) })