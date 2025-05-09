import express from "express"
import http from "http"
import { Server as SocketIOServer } from "socket.io"
import cors from "cors"
import dotenv from "dotenv"

// Load environment variables
dotenv.config()

// Create express app and HTTP server
const app = express()
const server = http.createServer(app)

// Configure CORS
const allowedOrigins = [
  process.env.CLIENT_URL || "https://v0-dealsfinder221.vercel.app",
  "http://localhost:3000",
  "https://dealsfinder221.vercel.app",
]

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, etc.)
      if (!origin) return callback(null, true)

      if (allowedOrigins.indexOf(origin) === -1) {
        const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}`
        return callback(new Error(msg), false)
      }
      return callback(null, true)
    },
    credentials: true,
  }),
)

// Create Socket.IO server
const io = new SocketIOServer(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
})

// Socket.IO connection handler
io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`)

  // Join admin room if admin token is provided
  socket.on("join-admin", (token) => {
    // In a production app, you would verify the token here
    if (token) {
      socket.join("admin-room")
      console.log(`Admin joined: ${socket.id}`)
      socket.emit("admin-joined", { success: true })
    }
  })

  // Handle client events
  socket.on("admin-action", (data) => {
    console.log("Admin action:", data)
    // Broadcast to all clients except sender
    socket.broadcast.emit(data.event, data.payload)
    // Also emit to sender for confirmation
    socket.emit("action-confirmed", { success: true, action: data })
  })

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`)
  })
})

// API endpoints
app.get("/", (req, res) => {
  res.send("WebSocket server is running")
})

app.post("/emit", express.json(), (req, res) => {
  const { event, data, room } = req.body

  if (!event) {
    return res.status(400).json({ error: "Event name is required" })
  }

  try {
    if (room) {
      io.to(room).emit(event, data)
    } else {
      io.emit(event, data)
    }

    res.json({ success: true, message: `Event ${event} emitted` })
  } catch (error) {
    console.error("Error emitting event:", error)
    res.status(500).json({ error: "Failed to emit event" })
  }
})

// Start server
const PORT = process.env.PORT || 4000
server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`)
})
