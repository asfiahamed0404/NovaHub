import "dotenv/config";
import mongoose from "mongoose";
import User from "../models/User.js";

const email = process.argv[2];

if (!email || typeof email !== "string" || !email.trim()) {
  console.error("Usage: npm run admin:promote -- user@example.com");
  process.exit(1);
}

if (!process.env.MONGO_URI) {
  console.error("MONGO_URI is required.");
  process.exit(1);
}

const targetEmail = email.trim().toLowerCase();

try {
  await mongoose.connect(process.env.MONGO_URI);
  const user = await User.findOne({ email: targetEmail });

  if (!user) {
    console.error(`User with email "${targetEmail}" not found.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  user.role = "admin";
  await user.save();

  console.log(`Successfully promoted user "${user.email}" (${user._id}) to platform role: admin.`);
  await mongoose.disconnect();
  process.exit(0);
} catch (error) {
  console.error("Failed to promote admin user:", error.message);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
}
