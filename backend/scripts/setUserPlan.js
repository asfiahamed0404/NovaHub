import "dotenv/config";
import mongoose from "mongoose";
import User from "../models/User.js";

const email = process.argv[2];
const plan = process.argv[3];

if (!email || !plan || typeof email !== "string" || typeof plan !== "string") {
  console.error("Usage: npm run user:set-plan -- user@example.com premium");
  process.exit(1);
}

const targetEmail = email.trim().toLowerCase();
const targetPlan = plan.trim().toLowerCase();

if (!["free", "premium"].includes(targetPlan)) {
  console.error('Invalid plan value. Must be either "free" or "premium".');
  process.exit(1);
}

if (!process.env.MONGO_URI) {
  console.error("MONGO_URI is required.");
  process.exit(1);
}

try {
  await mongoose.connect(process.env.MONGO_URI);
  const user = await User.findOne({ email: targetEmail });

  if (!user) {
    console.error(`User with email "${targetEmail}" not found.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  user.plan = targetPlan;
  await user.save();

  console.log(`Successfully updated user "${user.email}" (${user._id}) to product plan: ${targetPlan}.`);
  await mongoose.disconnect();
  process.exit(0);
} catch (error) {
  console.error("Failed to update user plan:", error.message);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
}
