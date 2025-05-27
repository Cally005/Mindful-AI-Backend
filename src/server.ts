import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import route from "./routes/index.route.js";
// Import any other necessary dependencies or services

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));

// Initialize any background workers or services here if needed
// For example:
// import { someWorkerQueue } from "./services/some-worker.js";
// someWorkerQueue.process((job) => {
//   console.log(job.data);
// });

// Routes
app.use("/api", route);

// Error handling middleware
app.use((err:any, reqa:any, res:any, next:any) => {
  console.error(err.stack);
  res.status(500).json({
    status: false,
    msg: "Something went wrong!"
  });
});

// Start server
app.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);