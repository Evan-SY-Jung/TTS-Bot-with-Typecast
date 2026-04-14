import mongoose from "mongoose";
import { getConfig } from "../config";
import { runVoiceDefaultMigration } from "./migrateVoiceDefaults";

export async function connectMongo() {
  const { mongoUri } = getConfig();

  mongoose.connection.on("connected", () => {
    console.log("MongoDB connected");
  });

  mongoose.connection.on("error", (err) => {
    console.error("MongoDB connection error:", err);
  });

  await mongoose.connect(mongoUri);
  await runVoiceDefaultMigration();
}

