import mongoose from "mongoose";

import AiUsageRateLimit from "../models/AiUsageRateLimit.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import Workspace from "../models/Workspace.js";
import WorkspaceMemory, {
  WORKSPACE_MEMORY_IMPORTANCE_LEVELS,
  WORKSPACE_MEMORY_TYPES,
} from "../models/WorkspaceMemory.js";
import {
  getEntitlementsForPlan,
  getEntitlementsForUser,
} from "../services/entitlements/entitlementService.js";
import {
  AdminUserNotFoundError,
  LastPlatformAdminError,
  updateUserWithAdminInvariant,
} from "../services/admin/adminUserService.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_PAGE = 10000;
const MAX_SEARCH_LENGTH = 100;
const RECENT_LIMIT = 5;
const DETAIL_RECENT_LIMIT = 10;
const DETAIL_MEMBER_LIMIT = 50;

const USER_ROLES = Object.freeze([
  ...User.schema.path("role").enumValues,
]);
const USER_PLANS = Object.freeze([
  ...User.schema.path("plan").enumValues,
]);

const escapeRegularExpression = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

const readQueryString = (value) =>
  typeof value === "string" ? value.trim() : "";

const readSearch = (value) =>
  readQueryString(value).slice(0, MAX_SEARCH_LENGTH);

const parsePositiveInteger = (value, fallback) => {
  if (typeof value !== "string" || !/^\d+$/u.test(value)) {
    return fallback;
  }

  const parsed = Number(value);

  return Number.isSafeInteger(parsed) && parsed > 0
    ? parsed
    : fallback;
};

const isValidPaginationValue = (value) => {
  if (value === undefined) {
    return true;
  }

  if (typeof value !== "string" || !/^\d+$/u.test(value)) {
    return false;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0;
};

const getPagination = (query) => {
  if (
    !isValidPaginationValue(query.page) ||
    !isValidPaginationValue(query.limit) ||
    (query.page !== undefined && Number(query.page) > MAX_PAGE)
  ) {
    return null;
  }

  return {
    page: parsePositiveInteger(query.page, DEFAULT_PAGE),
    limit: Math.min(
      parsePositiveInteger(query.limit, DEFAULT_LIMIT),
      MAX_LIMIT
    ),
  };
};

const makePagination = ({ page, limit, total }) => ({
  page,
  limit,
  total,
  pages: Math.ceil(total / limit),
});

const makeSearchExpression = (search) =>
  new RegExp(escapeRegularExpression(search), "iu");

const addUserClassificationFilter = ({
  filter,
  field,
  value,
  fallback,
  allowedValues,
}) => {
  if (!value) {
    return;
  }

  if (value !== fallback) {
    filter[field] = value;
    return;
  }

  if (!filter.$and) {
    filter.$and = [];
  }

  filter.$and.push({
    $or: [
      { [field]: fallback },
      { [field]: { $nin: allowedValues } },
    ],
  });
};

const toId = (value) =>
  value === null || value === undefined ? null : value.toString();

const makeUserDto = (user) => {
  if (!user) {
    return null;
  }

  const role = USER_ROLES.includes(user.role) ? user.role : "user";
  const plan = USER_PLANS.includes(user.plan) ? user.plan : "free";
  const entitlement = getEntitlementsForPlan(plan).aiSummary;

  return {
    id: toId(user._id || user.id),
    name: user.name,
    email: user.email,
    status: user.status,
    avatar: user.avatar,
    role,
    plan,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    aiEntitlement: {
      enabled: entitlement.enabled,
      requestsPerWindow: entitlement.requestsPerWindow,
      windowMinutes: entitlement.windowMinutes,
    },
  };
};

const makeCompactUserDto = (user) => {
  if (!user) {
    return null;
  }

  return {
    id: toId(user._id || user.id),
    name: user.name,
    email: user.email,
    role: USER_ROLES.includes(user.role) ? user.role : "user",
    plan: USER_PLANS.includes(user.plan) ? user.plan : "free",
  };
};

const makeMemoryDto = (memory) => {
  if (!memory) {
    return null;
  }

  const workspace = memory.workspaceDoc || memory.workspace;
  const createdBy = memory.createdByDoc || memory.createdBy;
  const sourceMessageIdsCount =
    memory.sourceMessageIdsCount ?? memory.sourceMessageIds?.length ?? 0;

  return {
    id: toId(memory._id || memory.id),
    workspace: workspace
      ? {
          id: toId(workspace._id || workspace.id || workspace),
          name: workspace.name,
        }
      : null,
    type: memory.type,
    content: memory.content,
    importance: memory.importance,
    createdBy: createdBy
      ? makeCompactUserDto(createdBy)
      : null,
    sourceMessageIdsCount,
    createdAt: memory.createdAt,
    updatedAt: memory.updatedAt,
  };
};

const makeUsageDto = (usage, user) => {
  const entitlement = getEntitlementsForUser(user).aiSummary;
  const windowStartedAt = usage?.windowStartedAt || null;
  const resetAt = windowStartedAt
    ? new Date(
        new Date(windowStartedAt).getTime() +
          entitlement.windowMinutes * 60 * 1000
      )
    : null;
  const windowIsActive = Boolean(
    resetAt && resetAt.getTime() > Date.now()
  );
  const requestCount = windowIsActive
    ? Math.max(0, Number(usage?.requestCount) || 0)
    : 0;
  const limit = entitlement.requestsPerWindow;

  return {
    user: makeCompactUserDto(user),
    plan: USER_PLANS.includes(user?.plan) ? user.plan : "free",
    requestCount,
    limit,
    remaining: Math.max(0, limit - requestCount),
    windowMinutes: entitlement.windowMinutes,
    windowStartedAt: windowIsActive ? windowStartedAt : null,
    resetAt: windowIsActive ? resetAt : null,
    isRateLimited: windowIsActive && requestCount >= limit,
    quotaScope: "Shared per-user AI quota",
    updatedAt: usage?.updatedAt || null,
  };
};

const groupCounts = (groups, allowedValues) => {
  const result = Object.fromEntries(
    allowedValues.map((value) => [value, 0])
  );

  for (const group of groups) {
    if (typeof group._id === "string") {
      result[group._id] = group.count;
    }
  }

  return result;
};

const sendUnexpectedError = (res, message) =>
  res.status(500).json({ message });

export const getAdminDashboard = async (_req, res) => {
  try {
    const [
      users,
      workspaces,
      messages,
      memories,
      planGroups,
      roleGroups,
      recentUsers,
      recentWorkspaces,
      recentMemories,
    ] = await Promise.all([
      User.countDocuments({}),
      Workspace.countDocuments({}),
      Message.countDocuments({}),
      WorkspaceMemory.countDocuments({}),
      User.aggregate([
        {
          $group: {
            _id: {
              $cond: [
                { $in: ["$plan", USER_PLANS] },
                "$plan",
                "free",
              ],
            },
            count: { $sum: 1 },
          },
        },
      ]),
      User.aggregate([
        {
          $group: {
            _id: {
              $cond: [
                { $in: ["$role", USER_ROLES] },
                "$role",
                "user",
              ],
            },
            count: { $sum: 1 },
          },
        },
      ]),
      User.find({})
        .select("name email status avatar role plan createdAt updatedAt")
        .sort({ createdAt: -1, _id: -1 })
        .limit(RECENT_LIMIT)
        .lean(),
      Workspace.aggregate([
        { $sort: { createdAt: -1, _id: -1 } },
        { $limit: RECENT_LIMIT },
        {
          $project: {
            name: 1,
            description: 1,
            createdAt: 1,
            updatedAt: 1,
            memberCount: { $size: { $ifNull: ["$members", []] } },
          },
        },
      ]),
      WorkspaceMemory.find({})
        .select(
          "workspace type content importance createdBy sourceMessageIds createdAt updatedAt"
        )
        .populate("workspace", "name")
        .populate("createdBy", "name email role plan")
        .sort({ createdAt: -1, _id: -1 })
        .limit(RECENT_LIMIT)
        .lean(),
    ]);

    return res.status(200).json({
      stats: { users, workspaces, messages, memories },
      usersByPlan: groupCounts(planGroups, USER_PLANS),
      usersByRole: groupCounts(roleGroups, USER_ROLES),
      recentUsers: recentUsers.map(makeUserDto),
      recentWorkspaces: recentWorkspaces.map((workspace) => ({
        id: toId(workspace._id),
        name: workspace.name,
        description: workspace.description,
        memberCount: workspace.memberCount,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
      })),
      recentMemories: recentMemories.map(makeMemoryDto),
    });
  } catch {
    return sendUnexpectedError(
      res,
      "Unable to load the admin dashboard."
    );
  }
};

export const listAdminUsers = async (req, res) => {
  try {
    const pagination = getPagination(req.query);

    if (!pagination) {
      return res.status(400).json({ message: "Invalid pagination values." });
    }

    const { page, limit } = pagination;
    const search = readSearch(req.query.search);
    const role = readQueryString(req.query.role);
    const plan = readQueryString(req.query.plan);

    if (role && !USER_ROLES.includes(role)) {
      return res.status(400).json({ message: "Invalid user role filter." });
    }

    if (plan && !USER_PLANS.includes(plan)) {
      return res.status(400).json({ message: "Invalid user plan filter." });
    }

    const filter = {};

    if (search) {
      const expression = makeSearchExpression(search);
      filter.$or = [{ name: expression }, { email: expression }];
    }
    addUserClassificationFilter({
      filter,
      field: "role",
      value: role,
      fallback: "user",
      allowedValues: USER_ROLES,
    });
    addUserClassificationFilter({
      filter,
      field: "plan",
      value: plan,
      fallback: "free",
      allowedValues: USER_PLANS,
    });

    const [items, total] = await Promise.all([
      User.find(filter)
        .select("name email status avatar role plan createdAt updatedAt")
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    return res.status(200).json({
      items: items.map(makeUserDto),
      pagination: makePagination({ page, limit, total }),
    });
  } catch {
    return sendUnexpectedError(res, "Unable to load users.");
  }
};

export const getAdminUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID." });
    }

    const user = await User.findById(userId)
      .select("name email status avatar role plan createdAt updatedAt")
      .lean();

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const entitlement = getEntitlementsForUser(user).aiSummary;
    const activeCutoff = new Date(
      Date.now() - entitlement.windowMinutes * 60 * 1000
    );
    const [workspaceCount, workspaces, usage] = await Promise.all([
      Workspace.countDocuments({ members: user._id }),
      Workspace.find({ members: user._id })
        .select("name createdAt updatedAt")
        .sort({ createdAt: -1, _id: -1 })
        .limit(DETAIL_RECENT_LIMIT)
        .lean(),
      AiUsageRateLimit.findOne({
        user: user._id,
        windowStartedAt: { $gt: activeCutoff },
      })
        .select("requestCount windowStartedAt expireAt createdAt updatedAt")
        .lean(),
    ]);

    return res.status(200).json({
      user: makeUserDto(user),
      workspaceCount,
      workspaces: workspaces.map((workspace) => ({
        id: toId(workspace._id),
        name: workspace.name,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
      })),
      aiUsage: usage ? makeUsageDto(usage, user) : null,
    });
  } catch {
    return sendUnexpectedError(res, "Unable to load this user.");
  }
};

export const updateAdminUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID." });
    }

    if (
      !req.body ||
      typeof req.body !== "object" ||
      Array.isArray(req.body)
    ) {
      return res.status(400).json({ message: "Invalid user update." });
    }

    const keys = Object.keys(req.body);
    const allowedFields = new Set(["role", "plan"]);

    if (keys.length === 0) {
      return res.status(400).json({
        message: "At least one of role or plan is required.",
      });
    }

    if (keys.some((key) => !allowedFields.has(key))) {
      return res.status(400).json({
        message: "Only role and plan can be updated.",
      });
    }

    const updates = {};

    if (Object.hasOwn(req.body, "role")) {
      if (!USER_ROLES.includes(req.body.role)) {
        return res.status(400).json({ message: "Invalid user role." });
      }
      updates.role = req.body.role;
    }

    if (Object.hasOwn(req.body, "plan")) {
      if (!USER_PLANS.includes(req.body.plan)) {
        return res.status(400).json({ message: "Invalid user plan." });
      }
      updates.plan = req.body.plan;
    }

    let updatedUser;

    try {
      if (updates.role === "user") {
        updatedUser = await updateUserWithAdminInvariant({
          userId,
          updates,
        });
      } else {
        updatedUser = await User.findByIdAndUpdate(
          userId,
          { $set: updates },
          { returnDocument: "after", runValidators: true }
        )
          .select("name email status avatar role plan createdAt updatedAt")
          .lean();
      }
    } catch (error) {
      if (error instanceof LastPlatformAdminError) {
        return res.status(409).json({
          message: "The last platform admin cannot be demoted.",
        });
      }

      if (error instanceof AdminUserNotFoundError) {
        return res.status(404).json({ message: "User not found." });
      }

      throw error;
    }

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found." });
    }

    return res.status(200).json({ user: makeUserDto(updatedUser) });
  } catch {
    return sendUnexpectedError(res, "Unable to update this user.");
  }
};

export const listAdminWorkspaces = async (req, res) => {
  try {
    const pagination = getPagination(req.query);

    if (!pagination) {
      return res.status(400).json({ message: "Invalid pagination values." });
    }

    const { page, limit } = pagination;
    const search = readSearch(req.query.search);
    const match = search
      ? { name: makeSearchExpression(search) }
      : {};

    const [result] = await Workspace.aggregate([
      { $match: match },
      { $sort: { createdAt: -1, _id: -1 } },
      {
        $facet: {
          items: [
            { $skip: (page - 1) * limit },
            { $limit: limit },
            {
              $lookup: {
                from: Message.collection.name,
                let: { workspaceId: "$_id" },
                pipeline: [
                  {
                    $match: {
                      $expr: { $eq: ["$workspace", "$$workspaceId"] },
                    },
                  },
                  { $count: "count" },
                ],
                as: "messageStats",
              },
            },
            {
              $lookup: {
                from: WorkspaceMemory.collection.name,
                let: { workspaceId: "$_id" },
                pipeline: [
                  {
                    $match: {
                      $expr: { $eq: ["$workspace", "$$workspaceId"] },
                    },
                  },
                  { $count: "count" },
                ],
                as: "memoryStats",
              },
            },
            {
              $project: {
                name: 1,
                description: 1,
                createdAt: 1,
                updatedAt: 1,
                memberCount: { $size: { $ifNull: ["$members", []] } },
                messageCount: {
                  $ifNull: [{ $first: "$messageStats.count" }, 0],
                },
                memoryCount: {
                  $ifNull: [{ $first: "$memoryStats.count" }, 0],
                },
              },
            },
          ],
          metadata: [{ $count: "total" }],
        },
      },
    ]);

    const total = result?.metadata?.[0]?.total || 0;
    const items = (result?.items || []).map((workspace) => ({
      id: toId(workspace._id),
      name: workspace.name,
      description: workspace.description,
      memberCount: workspace.memberCount,
      messageCount: workspace.messageCount,
      memoryCount: workspace.memoryCount,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
    }));

    return res.status(200).json({
      items,
      pagination: makePagination({ page, limit, total }),
    });
  } catch {
    return sendUnexpectedError(res, "Unable to load workspaces.");
  }
};

export const getAdminWorkspace = async (req, res) => {
  try {
    const { workspaceId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
      return res.status(400).json({ message: "Invalid workspace ID." });
    }

    const [workspace] = await Workspace.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(workspaceId),
        },
      },
      {
        $project: {
          name: 1,
          description: 1,
          createdBy: 1,
          createdAt: 1,
          updatedAt: 1,
          memberCount: {
            $size: { $ifNull: ["$members", []] },
          },
          memberIds: {
            $slice: [
              { $ifNull: ["$members", []] },
              DETAIL_MEMBER_LIMIT,
            ],
          },
        },
      },
    ]);

    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found." });
    }

    const memberCount = workspace.memberCount || 0;
    const [
      createdBy,
      members,
      messageCount,
      memoryCount,
      recentMessages,
      recentMemories,
    ] =
      await Promise.all([
        User.findById(workspace.createdBy)
          .select("name email role plan")
          .lean(),
        User.find({ _id: { $in: workspace.memberIds || [] } })
          .select("name email role plan")
          .sort({ createdAt: 1, _id: 1 })
          .limit(DETAIL_MEMBER_LIMIT)
          .lean(),
        Message.countDocuments({ workspace: workspace._id }),
        WorkspaceMemory.countDocuments({ workspace: workspace._id }),
        Message.find({ workspace: workspace._id })
          .select("sender messageType createdAt updatedAt")
          .populate("sender", "name email role plan")
          .sort({ createdAt: -1, _id: -1 })
          .limit(DETAIL_RECENT_LIMIT)
          .lean(),
        WorkspaceMemory.find({ workspace: workspace._id })
          .select(
            "workspace type content importance createdBy sourceMessageIds createdAt updatedAt"
          )
          .populate("workspace", "name")
          .populate("createdBy", "name email role plan")
          .sort({ createdAt: -1, _id: -1 })
          .limit(DETAIL_RECENT_LIMIT)
          .lean(),
      ]);

    const memberDtos = members.map(makeCompactUserDto);
    const workspaceDto = {
      id: toId(workspace._id),
      name: workspace.name,
      description: workspace.description,
      createdBy: makeCompactUserDto(createdBy),
      memberCount,
      messageCount,
      memoryCount,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
    };

    return res.status(200).json({
      workspace: workspaceDto,
      members: memberDtos,
      membersTruncated: memberCount > DETAIL_MEMBER_LIMIT,
      counts: {
        members: memberCount,
        messages: messageCount,
        memories: memoryCount,
      },
      recentMessages: recentMessages.map((message) => ({
        id: toId(message._id),
        sender: makeCompactUserDto(message.sender),
        messageType: message.messageType,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
      })),
      recentMemories: recentMemories.map(makeMemoryDto),
    });
  } catch {
    return sendUnexpectedError(res, "Unable to load this workspace.");
  }
};

export const listAdminAiUsage = async (req, res) => {
  try {
    const pagination = getPagination(req.query);

    if (!pagination) {
      return res.status(400).json({ message: "Invalid pagination values." });
    }

    const { page, limit } = pagination;
    const search = readSearch(req.query.search);
    const plan = readQueryString(req.query.plan);

    if (plan && !USER_PLANS.includes(plan)) {
      return res.status(400).json({ message: "Invalid user plan filter." });
    }

    // The current entitlement model uses one window length for every plan.
    // Query only active persisted windows so expired counters are not
    // presented as current usage.
    const longestWindowMinutes = Math.max(
      ...USER_PLANS.map(
        (userPlan) =>
          getEntitlementsForPlan(userPlan).aiSummary.windowMinutes
      )
    );
    const activeCutoff = new Date(
      Date.now() - longestWindowMinutes * 60 * 1000
    );
    const userMatch = {};

    if (plan) {
      userMatch.$expr = {
        $eq: [
          {
            $cond: [
              { $in: ["$userDoc.plan", USER_PLANS] },
              "$userDoc.plan",
              "free",
            ],
          },
          plan,
        ],
      };
    }
    if (search) {
      const expression = makeSearchExpression(search);
      userMatch.$or = [
        { "userDoc.name": expression },
        { "userDoc.email": expression },
      ];
    }

    const pipeline = [
      { $match: { windowStartedAt: { $gt: activeCutoff } } },
      {
        $lookup: {
          from: User.collection.name,
          localField: "user",
          foreignField: "_id",
          as: "userDoc",
        },
      },
      { $unwind: "$userDoc" },
    ];

    if (Object.keys(userMatch).length > 0) {
      pipeline.push({ $match: userMatch });
    }

    pipeline.push(
      { $sort: { requestCount: -1, updatedAt: -1, _id: 1 } },
      {
        $facet: {
          items: [
            { $skip: (page - 1) * limit },
            { $limit: limit },
            {
              $project: {
                requestCount: 1,
                windowStartedAt: 1,
                expireAt: 1,
                createdAt: 1,
                updatedAt: 1,
                userDoc: {
                  _id: 1,
                  name: 1,
                  email: 1,
                  role: 1,
                  plan: 1,
                },
              },
            },
          ],
          metadata: [{ $count: "total" }],
        },
      }
    );

    const [result] = await AiUsageRateLimit.aggregate(pipeline);
    const total = result?.metadata?.[0]?.total || 0;
    const items = (result?.items || []).map((usage) =>
      makeUsageDto(usage, usage.userDoc)
    );

    return res.status(200).json({
      items,
      pagination: makePagination({ page, limit, total }),
      semantics: {
        quotaScope: "Shared per-user AI quota",
        featureBreakdownAvailable: false,
      },
    });
  } catch {
    return sendUnexpectedError(res, "Unable to load AI usage.");
  }
};

export const listAdminMemories = async (req, res) => {
  try {
    const pagination = getPagination(req.query);

    if (!pagination) {
      return res.status(400).json({ message: "Invalid pagination values." });
    }

    const { page, limit } = pagination;
    const search = readSearch(req.query.search);
    const type = readQueryString(req.query.type);
    const importance = readQueryString(req.query.importance);
    const workspaceId = readQueryString(req.query.workspaceId);

    if (type && !WORKSPACE_MEMORY_TYPES.includes(type)) {
      return res.status(400).json({ message: "Invalid memory type filter." });
    }

    if (
      importance &&
      !WORKSPACE_MEMORY_IMPORTANCE_LEVELS.includes(importance)
    ) {
      return res.status(400).json({
        message: "Invalid memory importance filter.",
      });
    }

    if (workspaceId && !mongoose.Types.ObjectId.isValid(workspaceId)) {
      return res.status(400).json({ message: "Invalid workspace ID." });
    }

    const match = {};

    if (type) {
      match.type = type;
    }
    if (importance) {
      match.importance = importance;
    }
    if (workspaceId) {
      match.workspace = new mongoose.Types.ObjectId(workspaceId);
    }

    const workspaceLookupStages = [
      {
        $lookup: {
          from: Workspace.collection.name,
          localField: "workspace",
          foreignField: "_id",
          as: "workspaceDoc",
        },
      },
      {
        $unwind: {
          path: "$workspaceDoc",
          preserveNullAndEmptyArrays: true,
        },
      },
    ];
    const creatorLookupStages = [
      {
        $lookup: {
          from: User.collection.name,
          localField: "createdBy",
          foreignField: "_id",
          as: "createdByDoc",
        },
      },
      {
        $unwind: {
          path: "$createdByDoc",
          preserveNullAndEmptyArrays: true,
        },
      },
    ];
    const pipeline = [{ $match: match }];

    if (search) {
      const expression = makeSearchExpression(search);
      pipeline.push(
        ...workspaceLookupStages,
        {
          $match: {
            $or: [
              { content: expression },
              { "workspaceDoc.name": expression },
            ],
          },
        }
      );
    }

    const itemPipeline = [
      { $skip: (page - 1) * limit },
      { $limit: limit },
    ];

    if (!search) {
      itemPipeline.push(...workspaceLookupStages);
    }

    itemPipeline.push(
      ...creatorLookupStages,
      {
        $project: {
          type: 1,
          content: 1,
          importance: 1,
          createdAt: 1,
          updatedAt: 1,
          sourceMessageIdsCount: {
            $size: { $ifNull: ["$sourceMessageIds", []] },
          },
          workspaceDoc: {
            _id: 1,
            name: 1,
          },
          createdByDoc: {
            _id: 1,
            name: 1,
            email: 1,
            role: 1,
            plan: 1,
          },
        },
      }
    );

    pipeline.push(
      { $sort: { createdAt: -1, _id: -1 } },
      {
        $facet: {
          items: itemPipeline,
          metadata: [{ $count: "total" }],
        },
      }
    );

    const [result] = await WorkspaceMemory.aggregate(pipeline);
    const total = result?.metadata?.[0]?.total || 0;

    return res.status(200).json({
      items: (result?.items || []).map(makeMemoryDto),
      pagination: makePagination({ page, limit, total }),
    });
  } catch {
    return sendUnexpectedError(res, "Unable to load workspace memories.");
  }
};

export const deleteAdminMemory = async (req, res) => {
  try {
    const { memoryId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(memoryId)) {
      return res.status(400).json({ message: "Invalid memory ID." });
    }

    const deletedMemory = await WorkspaceMemory.findOneAndDelete({
      _id: memoryId,
    }).select("_id");

    if (!deletedMemory) {
      return res.status(404).json({ message: "Workspace memory not found." });
    }

    return res.status(200).json({
      message: "Workspace memory deleted successfully.",
      deletedMemoryId: toId(deletedMemory._id),
    });
  } catch {
    return sendUnexpectedError(
      res,
      "Unable to delete this workspace memory."
    );
  }
};
