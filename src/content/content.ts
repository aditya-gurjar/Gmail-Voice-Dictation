// Content script for Gmail voice dictation

let apiKey = "";
let apiKeyLoaded = false;

// Variable to store the recognition instance
let recognition: SpeechRecognition | null = null;

// Variable to store the current text area element
let activeTextArea: HTMLElement | null = null;

// Initialize when the content script is loaded
function initialize() {
  console.log("Gmail Voice Dictation content script initialized");

  // Load the API key from storage
  loadApiKey();

  // Listen for messages from the popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "updateApiKey") {
      console.log("Received new API key");
      apiKey = request.key;
      apiKeyLoaded = true;
      sendResponse({ success: true });
      return true;
    } else if (request.action === "startDictation") {
      if (!apiKeyLoaded || !apiKey) {
        sendResponse({
          success: false,
          error:
            "OpenAI API key not configured. Please set it in the extension settings.",
        });
        return true;
      }
      // Find compose area automatically - even if not focused
      const composeArea = findComposeArea();

      if (composeArea) {
        // Focus the compose area before starting dictation
        composeArea.focus();
        activeTextArea = composeArea;

        // Start dictation after a brief delay to ensure focus is set
        setTimeout(() => {
          startDictation();
        }, 100);

        sendResponse({ success: true });
      } else {
        sendResponse({
          success: false,
          error:
            "No compose area found. Please open a compose window in Gmail.",
        });
      }

      return true;
    } else if (request.action === "stopDictation") {
      stopDictation();
      sendResponse({ success: true });
      return true;
    } else if (request.action === "checkStatus") {
      // Check if we can find a compose area
      const composeArea = findComposeArea();
      sendResponse({
        ready: true,
        composeAreaFound: !!composeArea,
      });
      return true;
    }
  });

  // Add visual indicator for dictation status
  createVisualIndicator();
}

function loadApiKey() {
  chrome.storage.local.get(["openai_api_key"], function (result) {
    if (chrome.runtime.lastError) {
      console.error("Error loading API key:", chrome.runtime.lastError);
    } else if (result.openai_api_key) {
      apiKey = result.openai_api_key;
      apiKeyLoaded = true;
      console.log("API key loaded successfully");
    } else {
      console.log("No API key found in storage");
      apiKeyLoaded = false;
    }
  });
}

function findComposeArea(): HTMLElement | null {
  console.log("Looking for compose areas");

  // Try to find Gmail compose areas through multiple selectors

  // 1. Look for contenteditable div with specific attributes
  const composeElements = document.querySelectorAll('[contenteditable="true"]');
  console.log("Found contenteditable elements:", composeElements.length);

  for (const element of composeElements) {
    if (
      element.closest('[role="textbox"]') ||
      element.getAttribute("aria-label")?.includes("Message Body") ||
      element.getAttribute("g_editable") === "true" ||
      element.closest(".Am.Al.editable")
    ) {
      console.log("Found compose area by contenteditable");
      return element as HTMLElement;
    }
  }

  // 2. Look for specific Gmail compose container classes
  const composeContainers = document.querySelectorAll(
    ".Am.Al.editable, .Ak.aXjCH",
  );
  console.log("Found compose containers:", composeContainers.length);

  if (composeContainers.length > 0) {
    const container = composeContainers[0];
    const editableChild = container.querySelector('[contenteditable="true"]');
    if (editableChild) {
      console.log("Found compose area by container class");
      return editableChild as HTMLElement;
    }
    // If no editable child, return the container itself if it's editable
    if (container.getAttribute("contenteditable") === "true") {
      console.log("Using container as compose area");
      return container as HTMLElement;
    }
  }

  // 3. Last resort: look for iframe editor
  const editorIframes = document.querySelectorAll("iframe.editable");
  console.log("Found editor iframes:", editorIframes.length);

  if (editorIframes.length > 0) {
    try {
      const iframe = editorIframes[0] as HTMLIFrameElement;
      const iframeDocument =
        iframe.contentDocument || iframe.contentWindow?.document;
      if (iframeDocument) {
        const iframeBody = iframeDocument.body;
        if (iframeBody) {
          console.log("Using iframe body as compose area");
          return iframeBody as HTMLElement;
        }
      }
    } catch (e) {
      console.error("Error accessing iframe content:", e);
    }
  }

  console.log("No compose area found");
  return null;
}

// Create visual indicator element
function createVisualIndicator() {
  const indicator = document.createElement("div");
  indicator.id = "gmail-voice-indicator";
  indicator.style.position = "fixed";
  indicator.style.bottom = "20px";
  indicator.style.right = "20px";
  indicator.style.padding = "10px 15px";
  indicator.style.borderRadius = "20px";
  indicator.style.backgroundColor = "#ffffff";
  indicator.style.boxShadow = "0 2px 10px rgba(0, 0, 0, 0.1)";
  indicator.style.zIndex = "9999";
  indicator.style.display = "none";
  indicator.style.alignItems = "center";
  indicator.style.justifyContent = "center";
  indicator.style.fontFamily = "Arial, sans-serif";
  indicator.style.fontSize = "14px";
  indicator.style.transition = "all 0.3s ease";

  // Add microphone icon
  indicator.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#d93025" style="margin-right: 8px;">
        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z"/>
        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
      </svg>
      <span id="gmail-voice-indicator-text">Recording...</span>
    `;

  document.body.appendChild(indicator);
}

// Update the visual indicator
function updateVisualIndicator(
  show: boolean,
  message?: string,
  isError: boolean = false,
) {
  const indicator = document.getElementById("gmail-voice-indicator");
  const textElement = document.getElementById("gmail-voice-indicator-text");

  if (indicator && textElement) {
    if (show) {
      indicator.style.display = "flex";

      if (message) {
        textElement.textContent = message;
      }

      if (isError) {
        indicator.style.backgroundColor = "#ffebee";
        textElement.style.color = "#d32f2f";
      } else {
        indicator.style.backgroundColor = "#ffffff";
        textElement.style.color = "#333333";
      }
    } else {
      indicator.style.display = "none";
    }
  }
}

// Function to correct proper nouns using OpenAI API via fetch
async function correctProperNouns(text: string): Promise<string> {
  try {
    if (!apiKeyLoaded || !apiKey) {
      throw new Error(
        "OpenAI API key not configured. Please set it in the extension settings.",
      );
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant that corrects dictated text for emails. Your tasks are:\n\n1. Fix proper nouns (names, places, brands, etc.)\n2. Fix general capitalization issues (start of sentences, the word 'I', etc.)\n3. Add appropriate line breaks for email format (after greetings, between paragraphs, before sign-offs)\n4. DO NOT change the meaning or add/remove words from the original text\n5. Return only the corrected text without explanations",
          },
          {
            role: "user",
            content: text,
          },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `OpenAI API error: ${errorData.error?.message || response.statusText}`,
      );
    }

    const data = await response.json();

    // Return the corrected text
    return data.choices[0].message.content || text;
  } catch (error) {
    console.error("OpenAI API error:", error);
    // Return original text if there's an error
    return text;
  }
}

// Start voice dictation
function startDictation() {
  if (!("webkitSpeechRecognition" in window)) {
    updateVisualIndicator(true, "Speech recognition not supported", true);
    chrome.runtime.sendMessage({
      action: "updateStatus",
      status: "Error: Speech recognition not supported",
    });
    return;
  }

  recognition = new window.webkitSpeechRecognition();

  if (recognition) {
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    let interimTranscript = "";

    recognition.onstart = () => {
      console.log("Dictation started");
      updateVisualIndicator(true, "Recording...");
      showFloatingControl();
      chrome.runtime.sendMessage({
        action: "updateStatus",
        status: "Recording...",
      });
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          const transcript = event.results[i][0].transcript;
          // Correct proper nouns before inserting
          processAndInsertText(transcript);
        } else {
          interimTranscript += event.results[i][0].transcript;
          // Update the visual indicator with interim results
          updateVisualIndicator(
            true,
            "Listening: " + interimTranscript.slice(-30),
          );
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionError) => {
      console.error("Recognition error", event.error);
      updateVisualIndicator(true, `Error: ${event.error}`, true);
      chrome.runtime.sendMessage({
        action: "updateStatus",
        status: `Error: ${event.error}`,
      });
    };

    recognition.onend = () => {
      console.log("Dictation ended");
      updateVisualIndicator(false);
      hideFloatingControl();
      chrome.runtime.sendMessage({
        action: "updateStatus",
        status: "Dictation stopped",
      });
    };

    recognition.start();
  }
}

// Stop voice dictation
function stopDictation() {
  if (recognition) {
    recognition.stop();
    recognition = null;
    hideFloatingControl(); // Hide the floating control
    updateVisualIndicator(false);

    // Send status update
    chrome.runtime.sendMessage({
      action: "updateStatus",
      status: "Dictation stopped",
    });
  }
}

// Process text with OpenAI and insert it
async function processAndInsertText(text: string) {
  if (!text.trim() || !activeTextArea) return;

  try {
    // Show processing status
    updateVisualIndicator(true, "Processing text...");
    chrome.runtime.sendMessage({
      action: "updateStatus",
      status: "Processing text...",
    });

    // Correct proper nouns
    const correctedText = await correctProperNouns(text);

    // Insert the corrected text
    insertTextIntoActiveElement(correctedText);

    // Update status
    updateVisualIndicator(true, "Text inserted");
    chrome.runtime.sendMessage({
      action: "updateStatus",
      status: "Text inserted",
    });

    // Hide indicator after a delay
    setTimeout(() => {
      if (recognition) {
        updateVisualIndicator(true, "Recording...");
      } else {
        updateVisualIndicator(false);
      }
    }, 2000);
  } catch (error) {
    console.error("Error processing text:", error);

    // If processing fails, insert the original text
    insertTextIntoActiveElement(text);

    // Update status
    updateVisualIndicator(true, "Error processing text", true);
    chrome.runtime.sendMessage({
      action: "updateStatus",
      status: "Error processing text, inserted original",
    });
  }
}

// Insert text into the active text area
function insertTextIntoActiveElement(text: string) {
  if (!activeTextArea) return;

  // Process text to preserve line breaks from OpenAI
  // This ensures email formatting is maintained
  const formattedText = text.replace(/\n/g, "<br>");

  if (activeTextArea.isContentEditable) {
    // For contenteditable elements
    // Insert text at cursor position
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);

      // We'll use a temporary div to handle HTML formatting
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = formattedText;

      // Clear the current selection
      range.deleteContents();

      // Preserve order of nodes
      const fragment = document.createDocumentFragment();
      while (tempDiv.firstChild) {
        fragment.appendChild(tempDiv.firstChild);
      }

      range.insertNode(fragment);

      // Move cursor to the end of inserted text
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      // If no selection, append to the end
      activeTextArea.innerHTML += formattedText;
    }
  } else if (
    activeTextArea instanceof HTMLInputElement ||
    activeTextArea instanceof HTMLTextAreaElement
  ) {
    // For input/textarea elements
    const start = activeTextArea.selectionStart || 0;
    const end = activeTextArea.selectionEnd || 0;
    const value = activeTextArea.value;

    // For plain text inputs, replace <br> with actual newlines
    const plainText = formattedText.replace(/<br>/g, "\n");
    activeTextArea.value =
      value.substring(0, start) + plainText + value.substring(end);

    // Move cursor to the end of inserted text
    const newCursorPos = start + plainText.length;
    activeTextArea.selectionStart = newCursorPos;
    activeTextArea.selectionEnd = newCursorPos;
  }
}

// Add this function to content.ts
function createFloatingControl() {
  // Check if control already exists
  if (document.getElementById("gmail-voice-control")) {
    return;
  }

  // Create floating button
  const control = document.createElement("div");
  control.id = "gmail-voice-control";
  control.style.position = "fixed";
  control.style.bottom = "20px";
  control.style.right = "20px";
  control.style.width = "50px";
  control.style.height = "50px";
  control.style.borderRadius = "50%";
  control.style.backgroundColor = "#d93025";
  control.style.boxShadow = "0 2px 10px rgba(0, 0, 0, 0.2)";
  control.style.zIndex = "9999";
  control.style.display = "none";
  control.style.justifyContent = "center";
  control.style.alignItems = "center";
  control.style.cursor = "pointer";
  control.style.transition = "all 0.3s ease";

  // Add microphone/stop icon
  control.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#ffffff">
      <path d="M18 10.5l-6-6-6 6 6 6z"/>
    </svg>
  `;

  // Add tooltip
  control.title = "Stop Dictation";

  // Add click handler to stop dictation
  control.addEventListener("click", (e) => {
    // Stop event propagation to prevent focus change
    e.preventDefault();
    e.stopPropagation();

    // Store the currently active text area before stopping
    const currentTextArea = activeTextArea;

    // Stop dictation
    stopDictation();
    hideFloatingControl();

    // After stopping, ensure the original compose area is refocused
    if (currentTextArea) {
      setTimeout(() => {
        currentTextArea.focus();
      }, 50);
    }
  });

  control.addEventListener("mouseover", () => {
    control.style.transform = "scale(1.1)";
  });

  control.addEventListener("mouseout", () => {
    control.style.transform = "scale(1)";
  });

  document.body.appendChild(control);
}

// Function to show the floating control
function showFloatingControl() {
  const control = document.getElementById("gmail-voice-control");
  if (control) {
    control.style.display = "flex";
  } else {
    createFloatingControl();
    setTimeout(() => {
      const newControl = document.getElementById("gmail-voice-control");
      if (newControl) {
        newControl.style.display = "flex";
      }
    }, 100);
  }
}

// Function to hide the floating control
function hideFloatingControl() {
  const control = document.getElementById("gmail-voice-control");
  if (control) {
    control.style.display = "none";
  }
}

// Cleanup function when the page unloads
window.addEventListener("beforeunload", () => {
  if (recognition) {
    recognition.stop();
  }
  hideFloatingControl();
});

// Initialize the content script
initialize();
