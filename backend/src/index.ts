import express from "express";
import { ENV } from "./config/env";
import authroutes from "./routes/authroutes";
import userroutes from "./routes/userroutes";
import assetroutes from "./routes/assetsroutes";
import portfoliorouter from "./routes/portfolioroutes";
import cors from "cors";


const app = express();

app.use(cors({origin: ENV.FRONTEND_URL, credentials: true}));
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "API is running" });
});


app.use("/auth", authroutes);
app.use("/user", userroutes);
app.use('/assets', assetroutes);
app.use('/portfolios', portfoliorouter);


app.listen(ENV.PORT, () => {
  console.log(`Server is running on port ${ENV.PORT}`);
});

