import mongoose from "mongoose";

import Invitation, {
  deriveInvitationStatus,
  INVITATION_STATUSES,
} from "../models/Invitation.js";
import InvitationCreationLock from "../models/InvitationCreationLock.js";
import Workspace from "../models/Workspace.js";
import { getInvitationAbuseConfig } from "../utils/invitationConfig.js";
import {
  createInvitationExpiry,
  generateInvitationToken,
  hashInvitationToken,
  isValidInvitationToken,
} from "../utils/invitationToken.js";

const WORKSPACE_POPULATE_OPTIONS = [
  {
    path: "createdBy",
    select: "name email avatar status",
  },
  {
    path: "members",
    select: "name email avatar status",
  },
];

const INVITATION_ACTOR_POPULATE_OPTIONS = [
  {
    path: "createdBy",
    select: "name email avatar status",
  },
  {
    path: "usedBy",
    select: "name email avatar status",
  },
  {
    path: "revokedBy",
    select: "name email avatar status",
  },
];

const DEFAULT_INVITATION_LIST_LIMIT = 50;
const MAX_INVITATION_LIST_LIMIT = 100;

class InvitationRequestError extends Error {
  constructor(status, code, message, details = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const invitationError = (status, code, message, details) =>
  new InvitationRequestError(
    status,
    code,
    message,
    details
  );

const sendKnownError = (res, error) => {
  if (!(error instanceof InvitationRequestError)) {
    return false;
  }

  const retryAfterSeconds =
    error.details?.retryAfterSeconds;

  if (
    error.status === 429 &&
    Number.isSafeInteger(retryAfterSeconds)
  ) {
    res.set(
      "Retry-After",
      retryAfterSeconds.toString()
    );
  }

  res.status(error.status).json({
    message: error.message,
    code: error.code,
    ...error.details,
  });

  return true;
};

const invalidTokenError = () =>
  invitationError(
    400,
    "INVALID_INVITATION_TOKEN",
    "Invitation token is malformed."
  );

const invitationNotFoundError = () =>
  invitationError(
    404,
    "INVITATION_NOT_FOUND",
    "Invitation was not found."
  );

const invitationExpiredError = () =>
  invitationError(
    410,
    "INVITATION_EXPIRED",
    "Invitation has expired."
  );

const invitationUsedError = () =>
  invitationError(
    410,
    "INVITATION_ALREADY_USED",
    "Invitation has already been used."
  );

const invitationRevokedError = () =>
  invitationError(
    410,
    "INVITATION_REVOKED",
    "Invitation has been revoked."
  );

const invitationWorkspaceMissingError = () =>
  invitationError(
    410,
    "INVITATION_WORKSPACE_NOT_FOUND",
    "The workspace for this invitation is no longer available."
  );

const invalidWorkspaceIdError = () =>
  invitationError(
    400,
    "INVALID_WORKSPACE_ID",
    "Invalid workspace ID."
  );

const workspaceNotFoundError = () =>
  invitationError(
    404,
    "WORKSPACE_NOT_FOUND",
    "Workspace not found."
  );

const workspaceInvitationForbiddenError = () =>
  invitationError(
    403,
    "WORKSPACE_INVITATION_FORBIDDEN",
    "Only workspace members can manage invitations."
  );

const invalidInvitationIdError = () =>
  invitationError(
    400,
    "INVALID_INVITATION_ID",
    "Invalid invitation ID."
  );

const invalidInvitationLimitError = () =>
  invitationError(
    400,
    "INVALID_INVITATION_LIMIT",
    `Invitation list limit must be an integer from 1 through ${MAX_INVITATION_LIST_LIMIT}.`
  );

const invitationCreationRateLimitedError = (
  retryAfterSeconds
) =>
  invitationError(
    429,
    "INVITATION_CREATION_RATE_LIMITED",
    `Too many invitations were created recently. Try again in ${retryAfterSeconds} seconds.`,
    { retryAfterSeconds }
  );

const memberActiveInvitationLimitError = (limit) =>
  invitationError(
    409,
    "INVITATION_MEMBER_ACTIVE_LIMIT_REACHED",
    `You already have ${limit} active invitations for this workspace. Revoke one or wait for it to expire before creating another.`,
    { limit }
  );

const workspaceActiveInvitationLimitError = (limit) =>
  invitationError(
    409,
    "INVITATION_WORKSPACE_ACTIVE_LIMIT_REACHED",
    `This workspace already has ${limit} active invitations. Revoke one or wait for it to expire before creating another.`,
    { limit }
  );

const invitationNotActiveError = (
  invitation,
  status
) => {
  const errorsByStatus = {
    [INVITATION_STATUSES.USED]: {
      code: "INVITATION_ALREADY_USED",
      message: "Used invitations cannot be revoked.",
    },
    [INVITATION_STATUSES.EXPIRED]: {
      code: "INVITATION_EXPIRED",
      message: "Expired invitations cannot be revoked.",
    },
    [INVITATION_STATUSES.REVOKED]: {
      code: "INVITATION_ALREADY_REVOKED",
      message: "Invitation has already been revoked.",
    },
  };
  const error = errorsByStatus[status] || {
    code: "INVITATION_STATE_CHANGED",
    message: "Invitation is no longer active.",
  };

  return invitationError(
    409,
    error.code,
    error.message,
    {
      invitation: {
        id: invitation._id.toString(),
        status,
      },
    }
  );
};

const parseInvitationListLimit = (value) => {
  if (value === undefined) {
    return DEFAULT_INVITATION_LIST_LIMIT;
  }

  if (
    typeof value !== "string" ||
    !/^\d+$/.test(value)
  ) {
    throw invalidInvitationLimitError();
  }

  const limit = Number(value);

  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > MAX_INVITATION_LIST_LIMIT
  ) {
    throw invalidInvitationLimitError();
  }

  return limit;
};

const serializeInvitationActor = (actor) => {
  if (!actor) {
    return null;
  }

  const actorId = actor._id || actor;

  return {
    id: actorId.toString(),
    name:
      typeof actor.name === "string"
        ? actor.name
        : null,
    email:
      typeof actor.email === "string"
        ? actor.email
        : null,
    avatar:
      typeof actor.avatar === "string"
        ? actor.avatar
        : null,
    status:
      typeof actor.status === "string"
        ? actor.status
        : null,
  };
};

const serializeManagedInvitation = (
  invitation,
  now = new Date()
) => ({
  id: invitation._id.toString(),
  createdAt: invitation.createdAt,
  createdBy: serializeInvitationActor(
    invitation.createdBy
  ),
  expiresAt: invitation.expiresAt,
  usedAt: invitation.usedAt,
  usedBy: serializeInvitationActor(invitation.usedBy),
  revokedAt: invitation.revokedAt,
  revokedBy: serializeInvitationActor(
    invitation.revokedBy
  ),
  status: deriveInvitationStatus(invitation, now),
});

const getWorkspaceForInvitationManagement = async (
  workspaceId,
  userId
) => {
  if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
    throw invalidWorkspaceIdError();
  }

  const workspace = await Workspace.findById(
    workspaceId
  ).select("members");

  if (!workspace) {
    throw workspaceNotFoundError();
  }

  const isMember = workspace.members.some(
    (memberId) =>
      memberId.toString() === userId.toString()
  );

  if (!isMember) {
    throw workspaceInvitationForbiddenError();
  }

  return workspace;
};

const consumeInvitationCreationAttempt = async ({
  rateLimitLockId,
  workspaceId,
  abuseConfig,
  now = new Date(),
}) => {
  const rateLimitWindowMilliseconds =
    abuseConfig.creationRateLimitWindowMinutes *
    60 *
    1000;
  const rateLimitWindowStart = new Date(
    now.getTime() - rateLimitWindowMilliseconds
  );
  const availableWindowFilter = {
    _id: rateLimitLockId,
    workspace: workspaceId,
    rateWindowStartedAt: {
      $gt: rateLimitWindowStart,
    },
    rateCount: {
      $lt: abuseConfig.creationRateLimitMax,
    },
  };
  const incrementAttempt = () =>
    InvitationCreationLock.findOneAndUpdate(
      availableWindowFilter,
      { $inc: { rateCount: 1 } },
      { returnDocument: "after" }
    );

  let creationLock = await incrementAttempt();

  if (creationLock) {
    return;
  }

  creationLock =
    await InvitationCreationLock.findOneAndUpdate(
      {
        _id: rateLimitLockId,
        workspace: workspaceId,
        rateWindowStartedAt: {
          $lte: rateLimitWindowStart,
        },
      },
      {
        $set: {
          rateWindowStartedAt: now,
          rateCount: 1,
        },
      },
      { returnDocument: "after" }
    );

  if (creationLock) {
    return;
  }

  creationLock = await incrementAttempt();

  if (creationLock) {
    return;
  }

  const currentLock =
    await InvitationCreationLock.findById(
      rateLimitLockId
    ).select("rateWindowStartedAt rateCount");

  if (!currentLock) {
    throw new Error(
      "Invitation creation lock was unavailable."
    );
  }

  const retryAt =
    currentLock.rateWindowStartedAt.getTime() +
    rateLimitWindowMilliseconds;
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((retryAt - now.getTime()) / 1000)
  );

  throw invitationCreationRateLimitedError(
    retryAfterSeconds
  );
};

const getInvitationByRawToken = async (
  rawToken,
  session
) => {
  if (!isValidInvitationToken(rawToken)) {
    throw invalidTokenError();
  }

  const query = Invitation.findOne({
    tokenHash: hashInvitationToken(rawToken),
  });

  if (session) {
    query.session(session);
  }

  const invitation = await query;

  if (!invitation) {
    throw invitationNotFoundError();
  }

  return invitation;
};

const validateInvitationState = (
  invitation,
  now = new Date()
) => {
  const status = deriveInvitationStatus(
    invitation,
    now
  );

  switch (status) {
    case INVITATION_STATUSES.USED:
      throw invitationUsedError();
    case INVITATION_STATUSES.REVOKED:
      throw invitationRevokedError();
    case INVITATION_STATUSES.EXPIRED:
      throw invitationExpiredError();
    default:
      return;
  }
};

const sendUnexpectedError = (res) =>
  res.status(500).json({
    message: "Unable to process the invitation request.",
    code: "INVITATION_REQUEST_FAILED",
  });

export const createInvitation = async (req, res) => {
  let session;

  try {
    const { workspaceId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
      return res.status(400).json({
        message: "Invalid workspace ID.",
        code: "INVALID_WORKSPACE_ID",
      });
    }

    const workspace = await Workspace.findById(
      workspaceId
    ).select("members");

    if (!workspace) {
      return res.status(404).json({
        message: "Workspace not found.",
        code: "WORKSPACE_NOT_FOUND",
      });
    }

    const isMember = workspace.members.some(
      (memberId) =>
        memberId.toString() === req.user._id.toString()
    );

    if (!isMember) {
      return res.status(403).json({
        message:
          "Only workspace members can create invitations.",
        code: "WORKSPACE_INVITATION_FORBIDDEN",
      });
    }

    const abuseConfig = getInvitationAbuseConfig();
    const creationLockId =
      `workspace:${workspace._id.toString()}`;
    const rateLimitLockId =
      `member:${workspace._id.toString()}:${req.user._id.toString()}`;

    await InvitationCreationLock.updateOne(
      { _id: creationLockId },
      {
        $setOnInsert: {
          workspace: workspace._id,
          version: 0,
          rateWindowStartedAt: new Date(),
          rateCount: 0,
        },
      },
      {
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    await InvitationCreationLock.updateOne(
      { _id: rateLimitLockId },
      {
        $setOnInsert: {
          workspace: workspace._id,
          member: req.user._id,
          version: 0,
          rateWindowStartedAt: new Date(),
          rateCount: 0,
        },
      },
      {
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    await InvitationCreationLock.updateOne(
      {
        _id: rateLimitLockId,
        $or: [
          { rateWindowStartedAt: { $exists: false } },
          { rateCount: { $exists: false } },
        ],
      },
      {
        $set: {
          rateWindowStartedAt: new Date(),
          rateCount: 0,
        },
      }
    );

    await consumeInvitationCreationAttempt({
      rateLimitLockId,
      workspaceId: workspace._id,
      abuseConfig,
    });

    const rawToken = generateInvitationToken();
    let expiresAt;
    let invitation;

    session = await mongoose.startSession();

    await session.withTransaction(async () => {
      const creationLock =
        await InvitationCreationLock.findOneAndUpdate(
          {
            _id: creationLockId,
            workspace: workspace._id,
          },
          {
            $inc: { version: 1 },
          },
          {
            returnDocument: "after",
            session,
          }
        );

      if (!creationLock) {
        throw new Error(
          "Invitation creation lock was unavailable."
        );
      }

      const currentWorkspace = await Workspace.findById(
        workspace._id
      )
        .select("members")
        .session(session);

      if (!currentWorkspace) {
        throw workspaceNotFoundError();
      }

      const isStillMember = currentWorkspace.members.some(
        (memberId) =>
          memberId.toString() ===
          req.user._id.toString()
      );

      if (!isStillMember) {
        throw workspaceInvitationForbiddenError();
      }

      const now = new Date();
      const activeInvitationFilter = {
        workspace: currentWorkspace._id,
        usedAt: null,
        revokedAt: null,
        expiresAt: { $gt: now },
      };
      const memberActiveInvitationCount =
        await Invitation.countDocuments({
          ...activeInvitationFilter,
          createdBy: req.user._id,
        }).session(session);

      if (
        memberActiveInvitationCount >=
        abuseConfig.maxActivePerMember
      ) {
        throw memberActiveInvitationLimitError(
          abuseConfig.maxActivePerMember
        );
      }

      const workspaceActiveInvitationCount =
        await Invitation.countDocuments(
          activeInvitationFilter
        ).session(session);

      if (
        workspaceActiveInvitationCount >=
        abuseConfig.maxActivePerWorkspace
      ) {
        throw workspaceActiveInvitationLimitError(
          abuseConfig.maxActivePerWorkspace
        );
      }

      expiresAt = createInvitationExpiry(now);

      [invitation] = await Invitation.create(
        [
          {
            workspace: currentWorkspace._id,
            tokenHash: hashInvitationToken(rawToken),
            createdBy: req.user._id,
            expiresAt,
          },
        ],
        { session }
      );
    });

    if (!invitation || !expiresAt) {
      throw new Error(
        "Invitation creation did not complete."
      );
    }

    return res.status(201).json({
      message: "Invitation created successfully",
      invitation: {
        id: invitation._id.toString(),
        token: rawToken,
        expiresAt,
      },
    });
  } catch (error) {
    if (sendKnownError(res, error)) {
      return;
    }

    return sendUnexpectedError(res);
  } finally {
    if (session) {
      try {
        await session.endSession();
      } catch {
        // The transaction has already committed or aborted at this point.
      }
    }
  }
};

export const listWorkspaceInvitations = async (
  req,
  res
) => {
  try {
    const workspace =
      await getWorkspaceForInvitationManagement(
        req.params.workspaceId,
        req.user._id
      );
    const limit = parseInvitationListLimit(
      req.query.limit
    );
    const now = new Date();

    const invitationDocuments = await Invitation.find({
      workspace: workspace._id,
    })
      .select(
        "createdAt createdBy expiresAt usedAt usedBy revokedAt revokedBy"
      )
      .populate(INVITATION_ACTOR_POPULATE_OPTIONS)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1);

    const hasMore =
      invitationDocuments.length > limit;
    const invitations = invitationDocuments
      .slice(0, limit)
      .map((invitation) =>
        serializeManagedInvitation(invitation, now)
      );

    return res.status(200).json({
      count: invitations.length,
      limit,
      hasMore,
      invitations,
    });
  } catch (error) {
    if (sendKnownError(res, error)) {
      return;
    }

    return sendUnexpectedError(res);
  }
};

export const revokeInvitation = async (req, res) => {
  try {
    const workspace =
      await getWorkspaceForInvitationManagement(
        req.params.workspaceId,
        req.user._id
      );
    const { invitationId } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(invitationId)
    ) {
      throw invalidInvitationIdError();
    }

    const revokedAt = new Date();
    const invitation =
      await Invitation.findOneAndUpdate(
        {
          _id: invitationId,
          workspace: workspace._id,
          usedAt: null,
          revokedAt: null,
          expiresAt: { $gt: revokedAt },
        },
        {
          $set: {
            revokedAt,
            revokedBy: req.user._id,
          },
        },
        {
          returnDocument: "after",
          runValidators: true,
        }
      ).select(
        "createdAt createdBy expiresAt usedAt usedBy revokedAt revokedBy"
      );

    if (!invitation) {
      const currentInvitation = await Invitation.findOne({
        _id: invitationId,
        workspace: workspace._id,
      }).select(
        "createdAt createdBy expiresAt usedAt usedBy revokedAt revokedBy"
      );

      if (!currentInvitation) {
        throw invitationNotFoundError();
      }

      const currentStatus = deriveInvitationStatus(
        currentInvitation,
        revokedAt
      );

      throw invitationNotActiveError(
        currentInvitation,
        currentStatus
      );
    }

    await invitation.populate(
      INVITATION_ACTOR_POPULATE_OPTIONS
    );

    return res.status(200).json({
      message: "Invitation revoked successfully",
      invitation: serializeManagedInvitation(
        invitation,
        revokedAt
      ),
    });
  } catch (error) {
    if (sendKnownError(res, error)) {
      return;
    }

    return sendUnexpectedError(res);
  }
};

export const getInvitation = async (req, res) => {
  try {
    const invitation = await getInvitationByRawToken(
      req.params.token
    );

    validateInvitationState(invitation);

    const workspace = await Workspace.findById(
      invitation.workspace
    ).select("name");

    if (!workspace) {
      throw invitationWorkspaceMissingError();
    }

    return res.status(200).json({
      invitation: {
        workspace: {
          name: workspace.name,
        },
        expiresAt: invitation.expiresAt,
      },
    });
  } catch (error) {
    if (sendKnownError(res, error)) {
      return;
    }

    return sendUnexpectedError(res);
  }
};

export const acceptInvitation = async (req, res) => {
  let session;
  let acceptedWorkspaceId;
  let membershipChanged = false;

  try {
    if (!isValidInvitationToken(req.params.token)) {
      throw invalidTokenError();
    }

    const tokenHash = hashInvitationToken(
      req.params.token
    );

    session = await mongoose.startSession();

    await session.withTransaction(async () => {
      acceptedWorkspaceId = undefined;
      membershipChanged = false;

      const acceptedAt = new Date();
      const invitation = await Invitation.findOne({
        tokenHash,
      }).session(session);

      if (!invitation) {
        throw invitationNotFoundError();
      }

      const wasAcceptedByCurrentUser =
        invitation.usedAt &&
        invitation.usedBy?.toString() ===
          req.user._id.toString();

      if (
        invitation.usedAt &&
        !wasAcceptedByCurrentUser
      ) {
        throw invitationUsedError();
      }

      if (!invitation.usedAt) {
        validateInvitationState(invitation, acceptedAt);
      }

      const workspace = await Workspace.findById(
        invitation.workspace
      )
        .select("name members")
        .session(session);

      if (!workspace) {
        throw invitationWorkspaceMissingError();
      }

      if (invitation.usedAt) {
        const isStillMember = workspace.members.some(
          (memberId) =>
            memberId.toString() ===
            req.user._id.toString()
        );

        if (
          wasAcceptedByCurrentUser &&
          isStillMember
        ) {
          acceptedWorkspaceId = workspace._id;
          return;
        }

        throw invitationUsedError();
      }

      const isAlreadyMember = workspace.members.some(
        (memberId) =>
          memberId.toString() === req.user._id.toString()
      );

      if (isAlreadyMember) {
        throw invitationError(
          409,
          "ALREADY_WORKSPACE_MEMBER",
          "You are already a member of this workspace.",
          {
            workspace: {
              _id: workspace._id,
              name: workspace.name,
            },
          }
        );
      }

      const invitationClaim = await Invitation.updateOne(
        {
          _id: invitation._id,
          usedAt: null,
          revokedAt: null,
          expiresAt: { $gt: acceptedAt },
        },
        {
          $set: {
            usedAt: acceptedAt,
            usedBy: req.user._id,
          },
        },
        { session }
      );

      if (invitationClaim.modifiedCount !== 1) {
        throw invitationUsedError();
      }

      const membershipUpdate = await Workspace.updateOne(
        {
          _id: workspace._id,
          members: { $ne: req.user._id },
        },
        {
          $addToSet: {
            members: req.user._id,
          },
        },
        {
          runValidators: true,
          session,
        }
      );

      if (membershipUpdate.modifiedCount !== 1) {
        const currentWorkspace =
          await Workspace.findById(workspace._id)
            .select("name members")
            .session(session);

        if (!currentWorkspace) {
          throw invitationWorkspaceMissingError();
        }

        throw invitationError(
          409,
          "ALREADY_WORKSPACE_MEMBER",
          "You are already a member of this workspace.",
          {
            workspace: {
              _id: currentWorkspace._id,
              name: currentWorkspace.name,
            },
          }
        );
      }

      acceptedWorkspaceId = workspace._id;
      membershipChanged = true;
    });

    const acceptedWorkspace = await Workspace.findById(
      acceptedWorkspaceId
    ).populate(WORKSPACE_POPULATE_OPTIONS);

    if (!acceptedWorkspace) {
      throw invitationWorkspaceMissingError();
    }

    const io = req.app.get("io");

    if (io && membershipChanged) {
      try {
        io.to(acceptedWorkspace._id.toString()).emit(
          "workspace_updated",
          acceptedWorkspace
        );
      } catch {
        // Membership is already committed; the HTTP result remains successful.
      }
    }

    return res.status(200).json({
      message: membershipChanged
        ? "Invitation accepted successfully"
        : "Invitation was already accepted by this user",
      workspace: acceptedWorkspace,
    });
  } catch (error) {
    if (sendKnownError(res, error)) {
      return;
    }

    return sendUnexpectedError(res);
  } finally {
    if (session) {
      try {
        await session.endSession();
      } catch {
        // The transaction has already committed or aborted at this point.
      }
    }
  }
};
