const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validateRegister = (req, res, next) => {
  const { name, email, password } = req.body;
  const errors = [];

  if (typeof name !== "string" || name.trim().length < 2) {
    errors.push("Name must contain at least 2 characters.");
  }

  if (
    typeof email !== "string" ||
    !emailPattern.test(email.trim().toLowerCase())
  ) {
    errors.push("Please provide a valid email address.");
  }

  if (typeof password !== "string" || password.length < 6) {
    errors.push("Password must contain at least 6 characters.");
  }

  if (errors.length > 0) {
    return res.status(400).json({
      message: "Validation failed",
      errors,
    });
  }

  req.body.name = name.trim();
  req.body.email = email.trim().toLowerCase();

  next();
};

export const validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  const errors = [];

  if (
    typeof email !== "string" ||
    !emailPattern.test(email.trim().toLowerCase())
  ) {
    errors.push("Please provide a valid email address.");
  }

  if (typeof password !== "string" || password.length === 0) {
    errors.push("Password is required.");
  }

  if (errors.length > 0) {
    return res.status(400).json({
      message: "Validation failed",
      errors,
    });
  }

  req.body.email = email.trim().toLowerCase();

  next();
};