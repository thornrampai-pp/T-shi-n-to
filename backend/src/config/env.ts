import { EnvConfig } from "../interface/config.interface";
import dotenv from "dotenv";

dotenv.config({ quiet: true })
export const ENV: EnvConfig = {
  PORT: process.env.PORT!,
  DATABASE_URL: process.env.DATABASE_URL!,
  FRONTEND_URL: process.env.FRONTEND_URL!,
  ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET!,
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET!,
  RESET_PASSWORD_SECRET: process.env.RESET_PASSWORD_SECRET!,
  TWELVE_DATA_API_KEY: process.env.TWELVE_DATA_API_KEY!
}


// console.log(ENV.PORT)