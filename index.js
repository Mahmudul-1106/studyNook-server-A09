
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
let bookingCollection;

async function run() {
  try {
    const db = client.db("studyNook");
    roomsCollection = db.collection("rooms");
    bookingCollection = db.collection("bookingRooms")


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

    

    
    // POST: Create a New Booking with Slot Conflict Validation Checks
app.post("/bookings", async (req, res) => {
  try {
    const { roomId, roomName, roomImage, date, startTime, endTime, userEmail, userName, totalCost, specialNote } = req.body;

    // 1. Structural Validation Security Check
    if (!roomId || !date || startTime === undefined || endTime === undefined) {
      return res.status(400).json({ message: "Missing required booking reservation parameters." });
    }

    if (startTime >= endTime) {
      return res.status(400).json({ message: "End time must occur after the selected start time." });
    }

    // 2. CONFLICT CHECK: Search for overlapping time slots for this specific room on this date
    const overlappingBooking = await bookingCollection.findOne({
      roomId: roomId,
      date: date,
      $and: [
        { startTime: { $lt: endTime } },  // Existing booking starts before your requested slot ends
        { endTime: { $gt: startTime } }  // Existing booking ends after your requested slot starts
      ]
    });

    // 3. Reject if a conflict exists
    if (overlappingBooking) {
      return res.status(409).json({ 
        message: `This specific slot is already reserved from ${overlappingBooking.startTime}:00 to ${overlappingBooking.endTime}:00.` 
      });
    }

    // 4. No conflict found -> Create the booking document structure
    const newBooking = {
      roomId,
      roomName,
      roomImage,
      date,
      startTime,
      endTime,
      userEmail,
      userName,
      totalCost,
      specialNote,
      status: "confirmed", // Default status indicator state
      createdAt: new Date()
    };

    const bookingResult = await bookingCollection.insertOne(newBooking);

    // 5. ATOMIC INCREMENT: Boost the bookingCount metric counter inside the rooms collection
    await roomsCollection.updateOne(
      { _id: new ObjectId(roomId) /* Use new ObjectId(roomId) if stored as standard BSON ObjectIds */ },
      { $inc: { bookingCount: 1 } }
    );

    // Return success to the frontend client framework
    res.status(201).json({
      success: true,
      message: "Room booked successfully!",
      bookingId: bookingResult.insertedId
    });

  } catch (error) {
    console.error("❌ Fatal Booking Transaction Failure:", error);
    res.status(500).json({ message: "Internal server error while processing reservation.", error: error.message });
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