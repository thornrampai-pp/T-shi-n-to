import express from "express";
import { ENV } from "./config/env";
import authroutes from "./routes/authroutes";
import userroutes from "./routes/userroutes";
import cors from "cors";


const app = express();

app.use(cors({origin: ENV.FRONTEND_URL, credentials: true}));
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "API is running" });
});


app.use("/api/auth", authroutes);
app.use("/api/user", userroutes);

app.listen(ENV.PORT, () => {
  console.log(`Server is running on port ${ENV.PORT}`);
});

