import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const backendDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const composeFile = path.join(
  backendDirectory,
  "tests",
  "integration",
  "docker-compose.yml"
);
const composeProject = "novahub-aisummary-tests";
const databaseName = "novahub_aisummary_test";
const testMongoUri =
  `mongodb://127.0.0.1:27019/${databaseName}` +
  "?replicaSet=rs0&directConnection=true";
const dockerCommand =
  process.platform === "win32" ? "docker.exe" : "docker";
const testFile =
  "tests/integration/aiSummary.integration.test.js";
const composeArguments = [
  "compose",
  "--project-name",
  composeProject,
  "--file",
  composeFile,
];

const run = (
  command,
  argumentsList,
  { captureOutput = false, allowFailure = false } = {}
) => {
  const result = spawnSync(command, argumentsList, {
    cwd: backendDirectory,
    env: process.env,
    encoding: "utf8",
    stdio: captureOutput ? "pipe" : "inherit",
    windowsHide: true,
  });

  if (result.error) {
    throw result.error;
  }

  if (!allowFailure && result.status !== 0) {
    throw new Error(
      `${command} exited with status ${result.status}.`
    );
  }

  return result;
};

const runCompose = (argumentsList, options) =>
  run(
    dockerCommand,
    [...composeArguments, ...argumentsList],
    options
  );

const waitForPrimary = async () => {
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    const result = runCompose(
      [
        "exec",
        "--no-TTY",
        "mongo",
        "mongosh",
        "--quiet",
        "--port",
        "27019",
        "--eval",
        "quit(db.hello().isWritablePrimary ? 0 : 2)",
      ],
      { captureOutput: true, allowFailure: true }
    );

    if (result.status === 0) {
      return;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 1000);
    });
  }

  throw new Error(
    "Disposable MongoDB replica set did not become primary."
  );
};

let composeStarted = false;

try {
  composeStarted = true;
  runCompose([
    "up",
    "--detach",
    "--wait",
    "--wait-timeout",
    "120",
  ]);

  runCompose([
    "exec",
    "--no-TTY",
    "mongo",
    "mongosh",
    "--quiet",
    "--port",
    "27019",
    "--eval",
    `try { rs.status() } catch (error) { rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "localhost:27019" }] }) }`,
  ]);

  await waitForPrimary();

  const testResult = spawnSync(
    process.execPath,
    [
      "--test",
      "--test-concurrency=1",
      testFile,
    ],
    {
      cwd: backendDirectory,
      env: {
        ...process.env,
        TEST_MONGO_URI: testMongoUri,
        CONFIRM_AISUMMARY_TEST_DATABASE: databaseName,
      },
      encoding: "utf8",
      stdio: "inherit",
      windowsHide: true,
    }
  );

  if (testResult.error) {
    throw testResult.error;
  }

  if (testResult.status !== 0) {
    process.exitCode = testResult.status || 1;
  }
} finally {
  if (composeStarted) {
    runCompose(
      ["down", "--volumes", "--remove-orphans"],
      { allowFailure: true }
    );
  }
}
