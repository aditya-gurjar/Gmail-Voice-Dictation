// Popup script for controlling the voice dictation

function checkStorageContents() {
  chrome.storage.local.get(null, (items) => {
    console.log("All items in chrome.storage.local:", items);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  checkStorageContents();
  const startBtn = document.getElementById("startBtn") as HTMLButtonElement;
  const statusDiv = document.getElementById("status") as HTMLDivElement;
  let isRecording = false;

  // Function to update the status display
  const updateStatus = (
    message: string,
    type: "normal" | "recording" | "processing" | "error" = "normal",
  ) => {
    statusDiv.textContent = message;

    // Remove all status classes
    statusDiv.classList.remove(
      "status-recording",
      "status-processing",
      "status-error",
    );

    // Add the appropriate class
    if (type !== "normal") {
      statusDiv.classList.add(`status-${type}`);
    }
  };

  if (startBtn && statusDiv) {
    // Initialize with default state
    startBtn.disabled = true; // Start disabled until we confirm everything's ready
    updateStatus("Checking Gmail status...");

    // Check if we're on Gmail
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentTab = tabs[0];

      console.log("Current tab:", currentTab);

      if (
        currentTab &&
        currentTab.url &&
        currentTab.url.includes("mail.google.com")
      ) {
        // Check if content script is ready and if compose area is found
        if (currentTab.id) {
          chrome.tabs.sendMessage(
            currentTab.id,
            { action: "checkStatus" },
            (response) => {
              if (chrome.runtime.lastError) {
                console.error(
                  "Error checking status:",
                  chrome.runtime.lastError,
                );
                updateStatus(
                  "Extension not fully loaded. Try refreshing the page.",
                  "error",
                );
                return;
              }

              if (response && response.ready) {
                if (response.composeAreaFound) {
                  startBtn.disabled = false;
                  updateStatus("Ready to record in Gmail");
                } else {
                  startBtn.disabled = true;
                  updateStatus(
                    "Please open a compose window in Gmail",
                    "error",
                  );
                }
              } else {
                updateStatus(
                  "Please refresh Gmail page to activate extension",
                  "error",
                );
              }
            },
          );
        }
      } else {
        startBtn.disabled = true;
        updateStatus("Please open Gmail to use this extension", "error");
      }
    });

    // Set up button click handler
    startBtn.addEventListener("click", () => {
      if (!isRecording) {
        // Start dictation
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0].id) {
            chrome.tabs.sendMessage(
              tabs[0].id,
              { action: "startDictation" },
              (response) => {
                if (chrome.runtime.lastError) {
                  console.error("Error:", chrome.runtime.lastError);
                  updateStatus(
                    "Error: " + chrome.runtime.lastError.message,
                    "error",
                  );
                  return;
                }

                if (response && response.success) {
                  isRecording = true;
                  startBtn.textContent = "Stop Dictation";
                  updateStatus("Recording...", "recording");
                } else {
                  updateStatus(
                    response?.error || "Failed to start dictation",
                    "error",
                  );
                }
              },
            );
          }
        });
      } else {
        // Stop dictation
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0].id) {
            chrome.tabs.sendMessage(
              tabs[0].id,
              { action: "stopDictation" },
              (response) => {
                if (chrome.runtime.lastError) {
                  console.error("Error:", chrome.runtime.lastError);
                  updateStatus(
                    "Error: " + chrome.runtime.lastError.message,
                    "error",
                  );
                  return;
                }

                if (response && response.success) {
                  isRecording = false;
                  startBtn.textContent = "Start Dictation";
                  updateStatus("Dictation stopped");
                } else {
                  updateStatus("Failed to stop dictation", "error");
                }
              },
            );
          }
        });
      }
    });

    // Listen for status updates from content script
    chrome.runtime.onMessage.addListener((request) => {
      if (request.action === "updateStatus") {
        // Determine status type
        let statusType: "normal" | "recording" | "processing" | "error" =
          "normal";

        if (request.status.includes("Recording")) {
          statusType = "recording";
        } else if (request.status.includes("Processing")) {
          statusType = "processing";
        } else if (request.status.includes("Error")) {
          statusType = "error";
        }

        updateStatus(request.status, statusType);

        // If dictation has stopped, update button state
        if (request.status === "Dictation stopped") {
          isRecording = false;
          startBtn.textContent = "Start Dictation";
        }
      }
    });
  }

  // Add to popup.ts after the existing button handlers
  const settingsBtn = document.getElementById(
    "settingsBtn",
  ) as HTMLButtonElement;
  const settingsPanel = document.getElementById(
    "settingsPanel",
  ) as HTMLDivElement;
  const apiKeyInput = document.getElementById("apiKey") as HTMLInputElement;
  const saveSettingsBtn = document.getElementById(
    "saveSettingsBtn",
  ) as HTMLButtonElement;

  if (settingsBtn && settingsPanel && apiKeyInput && saveSettingsBtn) {
    // Load saved API key
    chrome.storage.local.get(["openai_api_key"], function (result) {
      if (result.openai_api_key) {
        apiKeyInput.value = result.openai_api_key;
      }
    });

    // Toggle settings panel
    settingsBtn.addEventListener("click", () => {
      if (settingsPanel.style.display === "none") {
        settingsPanel.style.display = "block";
      } else {
        settingsPanel.style.display = "none";
      }
    });

    // Save settings
    saveSettingsBtn.addEventListener("click", () => {
      const key = apiKeyInput.value.trim();
      if (key) {
        console.log("Attempting to save API key...");
        chrome.storage.local.set({ openai_api_key: key }, () => {
          if (chrome.runtime.lastError) {
            console.error("Error saving API key:", chrome.runtime.lastError);
            updateStatus(
              "Error saving API key: " + chrome.runtime.lastError.message,
              "error",
            );
          } else {
            console.log("API key saved successfully");
            updateStatus("API key saved", "normal");
            settingsPanel.style.display = "none";

            // Send message to content script to update its key
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
              if (tabs[0].id) {
                chrome.tabs.sendMessage(tabs[0].id, {
                  action: "updateApiKey",
                  key: key,
                });
              }
            });
          }
        });
      } else {
        updateStatus("Please enter a valid API key", "error");
      }
    });
  }
});
