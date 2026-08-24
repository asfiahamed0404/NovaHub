function formatAdminDate(value, options = {}) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: options.dateStyle || "medium",
    ...(options.dateOnly ? {} : { timeStyle: "short" }),
  }).format(date);
}

function formatAdminNumber(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0";
  }

  return new Intl.NumberFormat().format(number);
}

function titleCase(value, fallback = "Not set") {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  return value
    .trim()
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getAdminEntityId(entity) {
  return entity?.id || entity?._id || "";
}

function getAdminPagination(pagination, fallbackLimit = 20) {
  const page = Math.max(1, Number(pagination?.page) || 1);
  const limit = Math.max(
    1,
    Number(pagination?.limit) || fallbackLimit
  );
  const total = Math.max(0, Number(pagination?.total) || 0);
  const pages = Math.max(
    1,
    Number(pagination?.pages) || Math.ceil(total / limit) || 1
  );

  return {
    page: Math.min(page, pages),
    limit,
    total,
    pages,
  };
}

function getAdminInitials(name, email) {
  const source =
    typeof name === "string" && name.trim()
      ? name.trim()
      : email || "Admin";

  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function getAdminUsageStatus(usage) {
  if (
    usage?.status === "available" ||
    usage?.status === "near-limit" ||
    usage?.status === "rate-limited"
  ) {
    return usage.status;
  }

  const requestCount = Number(usage?.requestCount) || 0;
  const limit = Number(usage?.limit) || 0;

  if (
    usage?.isLimited ||
    usage?.isRateLimited ||
    (limit > 0 && requestCount >= limit)
  ) {
    return "rate-limited";
  }

  if (limit > 0 && requestCount / limit >= 0.8) {
    return "near-limit";
  }

  return "available";
}

export {
  formatAdminDate,
  formatAdminNumber,
  getAdminEntityId,
  getAdminInitials,
  getAdminPagination,
  getAdminUsageStatus,
  titleCase,
};
