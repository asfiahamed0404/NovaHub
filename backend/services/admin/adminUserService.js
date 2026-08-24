import mongoose from "mongoose";

import PlatformAdminRoleLock from "../../models/PlatformAdminRoleLock.js";
import User from "../../models/User.js";

const PLATFORM_ADMIN_ROLE_LOCK_ID = "platform-admin-role";

export class LastPlatformAdminError extends Error {}
export class AdminUserNotFoundError extends Error {}

const ensurePlatformAdminRoleLock = async () => {
  try {
    await PlatformAdminRoleLock.updateOne(
      { _id: PLATFORM_ADMIN_ROLE_LOCK_ID },
      { $setOnInsert: { revision: 0 } },
      { upsert: true }
    );
  } catch (error) {
    // Simultaneous first use can race the singleton upsert. The winning
    // insert leaves the lock ready for both callers.
    if (error?.code !== 11000) {
      throw error;
    }
  }
};

export const updateUserWithAdminInvariant = async ({
  userId,
  updates,
}) => {
  await ensurePlatformAdminRoleLock();

  const session = await mongoose.startSession();
  let updatedUser = null;

  try {
    await session.withTransaction(
      async () => {
        // Every demotion transaction writes the same document before reading
        // the admin count. MongoDB will retry a transaction that loses this
        // write conflict, giving it a fresh view of the invariant.
        await PlatformAdminRoleLock.findOneAndUpdate(
          { _id: PLATFORM_ADMIN_ROLE_LOCK_ID },
          { $inc: { revision: 1 } },
          { returnDocument: "after", session }
        );

        const targetUser = await User.findById(userId)
          .select("role")
          .session(session);

        if (!targetUser) {
          throw new AdminUserNotFoundError();
        }

        if (targetUser.role === "admin" && updates.role === "user") {
          const adminCount = await User.countDocuments({
            role: "admin",
          }).session(session);

          if (adminCount <= 1) {
            throw new LastPlatformAdminError();
          }
        }

        updatedUser = await User.findByIdAndUpdate(
          userId,
          { $set: updates },
          {
            returnDocument: "after",
            runValidators: true,
            session,
          }
        )
          .select("name email status avatar role plan createdAt updatedAt")
          .lean();
      },
      {
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
      }
    );
  } finally {
    await session.endSession();
  }

  return updatedUser;
};

