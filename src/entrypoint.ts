import triggerSmartOrderSystem from "./smartOrder";

const DEFAULT_SERVICE_DATE = new Date(Date.UTC(2025, 7, 24));

triggerSmartOrderSystem(DEFAULT_SERVICE_DATE)
  .then(() => {
    console.log("Done");
  })
  .catch((error: Error) => {
    console.error("Something went wrong");
    console.error(error);
  });
