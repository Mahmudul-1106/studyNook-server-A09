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
    bookingCollection = db.collection("bookingRooms");


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

    // GET: My-Bookings
    app.get("/bookings", async (req, res) => {
      try {
        const { email } = req.query;
        let query = {};
        if (email) {
          query.userEmail = email; 
        }
        const result = await bookingCollection.find(query).toArray();
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch bookings." });
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

        if (!roomId || !date || startTime === undefined || endTime === undefined) {
          return res.status(400).json({ message: "Missing required booking reservation parameters." });
        }

        if (startTime >= endTime) {
          return res.status(400).json({ message: "End time must occur after the selected start time." });
        }

        const overlappingBooking = await bookingCollection.findOne({
          roomId: roomId,
          date: date,
          $and: [
            { startTime: { $lt: endTime } },  
            { endTime: { $gt: startTime } }  
          ]
        });

        if (overlappingBooking) {
          return res.status(409).json({ 
            message: `This specific slot is already reserved from ${overlappingBooking.startTime}:00 to ${overlappingBooking.endTime}:00.` 
          });
        }

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
          status: "confirmed", 
          createdAt: new Date()
        };

        const bookingResult = await bookingCollection.insertOne(newBooking);

        await roomsCollection.updateOne(
          { _id: new ObjectId(roomId) },
          { $inc: { bookingCount: 1 } }
        );

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

    // 🔥 FIXED: Changed router.put to app.put, moved it safely inside run(), and used roomsCollection directly
    app.put('/rooms/:id', async (req, res) => {
      try {
        const roomId = req.params.id;
        
        if (!ObjectId.isValid(roomId)) {
          return res.status(400).json({ success: false, message: "Invalid room identifier formatting." });
        }

        const { name, pricePerHour, floor, capacity, image, bio, amenities } = req.body;

        if (!name || !pricePerHour || !capacity) {
          return res.status(400).json({ success: false, message: "Missing required core parameters." });
        }

        const updatedDocument = {
          $set: {
            name,
            pricePerHour: Number(pricePerHour),
            floor: Number(floor),
            capacity: Number(capacity),
            image,
            bio,
            amenities: Array.isArray(amenities) ? amenities : [], 
          }
        };

        const result = await roomsCollection.updateOne(
          { _id: new ObjectId(roomId) },
          updatedDocument
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({ success: false, message: "Target room record not found." });
        }

        res.status(200).json({ 
          success: true, 
          message: "Room listing configurations altered successfully." 
        });

      } catch (error) {
        console.error("Backend update failure context:", error);
        res.status(500).json({ success: false, message: "Internal server error during modification." });
      }
    });

    // DELETE: Remove Room
    app.delete("/rooms/:id", async (req, res) => {
      const { id } = req.params;
      const result = await roomsCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.json(result);
    });

    // PATCH: Cancel an Active Room Booking Safely
    app.patch("/bookings/:id/cancel", async (req, res) => {
      try {
        const bookingId = req.params.id;
        const { userEmail } = req.body; 

        if (!userEmail) {
          return res.status(400).json({ message: "User context email validation required." });
        }

        const booking = await bookingCollection.findOne({ _id: new ObjectId(bookingId) });

        if (!booking) {
          return res.status(404).json({ message: "Target booking document not found." });
        }

        if (booking.userEmail !== userEmail) {
          return res.status(403).json({ message: "Forbidden: You cannot cancel another user's reservation." });
        }

        if (booking.status === "cancelled") {
          return res.status(400).json({ message: "This reservation is already cancelled." });
        }

        const updateResult = await bookingCollection.updateOne(
          { _id: new ObjectId(bookingId) },
          { $set: { status: "cancelled" } }
        );

        await db.collection("users").updateOne(
          { email: userEmail },
          { $pull: { bookedRooms: new ObjectId(bookingId) } } 
        );

        if (booking.roomId) {
          await roomsCollection.updateOne(
            { _id: booking.roomId.toString().length === 24 ? new ObjectId(booking.roomId) : booking.roomId },
            { $inc: { bookingCount: -1 } }
          );
        }

        res.status(200).json({
          success: true,
          message: "Booking cancelled successfully.",
          modifiedCount: updateResult.modifiedCount
        });

      } catch (error) {
        console.error("❌ Cancellation endpoint failure:", error);
        res.status(500).json({ message: "Internal server error during reservation rollback.", error: error.message });
      }
    });

  } finally {
    // Keeps connection alive
  }
}

run().catch(console.dir);

app.get('/', (req, res) => { res.send('Server is running fine') })
app.listen(port, () => { console.log(`Example app listening on port ${port}`) })