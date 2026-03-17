const flushPromises = async () =>
  new Promise<void>((resolve) => {
    setImmediate(resolve);
  });

describe("entrypoint", () => {
  afterEach(() => {
    jest.dontMock("../src/db");
    jest.dontMock("../src/smartOrder");
    jest.resetModules();
    jest.clearAllMocks();
    delete process.exitCode;
  });

  it("runs the smart ordering flow for the default service date and logs the summary", async () => {
    const disconnect = jest.fn().mockResolvedValue(undefined);
    const triggerSmartOrderSystem = jest.fn().mockResolvedValue({
      patientsProcessed: 2,
      mealsCreated: 4,
      mealsSkipped: 1,
      skippedByReason: { max_calories_exceeded: 1 },
      patientResults: [{ patientId: "patient-1", patientName: "Test Patient", outcomes: [] }],
    });

    jest.doMock("../src/db", () => ({
      db: { $disconnect: disconnect },
    }));
    jest.doMock("../src/smartOrder", () => ({
      __esModule: true,
      default: triggerSmartOrderSystem,
    }));

    await jest.isolateModulesAsync(async () => {
      require("../src/entrypoint");
      await flushPromises();
    });

    expect(triggerSmartOrderSystem).toHaveBeenCalledWith(new Date("2025-08-24T00:00:00.000Z"));
    expect(console.log).toHaveBeenCalledWith("\nDone:", {
      patientsProcessed: 2,
      mealsCreated: 4,
      mealsSkipped: 1,
      skippedByReason: { max_calories_exceeded: 1 },
    });
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it("sets a non-zero exit code and disconnects when the smart ordering flow fails", async () => {
    const disconnect = jest.fn().mockResolvedValue(undefined);
    const error = new Error("boom");
    const triggerSmartOrderSystem = jest.fn().mockRejectedValue(error);
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

    jest.doMock("../src/db", () => ({
      db: { $disconnect: disconnect },
    }));
    jest.doMock("../src/smartOrder", () => ({
      __esModule: true,
      default: triggerSmartOrderSystem,
    }));

    await jest.isolateModulesAsync(async () => {
      require("../src/entrypoint");
      await flushPromises();
    });

    expect(process.exitCode).toBe(1);
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(1, "Something went wrong");
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(2, error);
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
