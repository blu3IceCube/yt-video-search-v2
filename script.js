let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;
let captionBox = null;
let groupedCaptions = []; // This now holds the caption segments from the backend
let player;
let transcriptSegmentsData = []; // Store the speaker-segmented transcript data

// Toggle sidebar visibility
function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  sidebar.classList.toggle("active");

  const expandBtn = document.getElementById("expand-btn");
  if (sidebar.classList.contains("active")) {
    expandBtn.textContent = "Collapse";
  } else {
    expandBtn.textContent = "Expand";
  }
}

// Main function to load video and transcript
async function loadVideo() {
  const videoURL = document.getElementById("yt-url-input").value;
  const videoContainer = document.getElementById("video-container");
  const transcriptContent = document.getElementById("transcript-content");
  const loadingIndicator = document.getElementById("loading-indicator");

  // Clear previous content and state
  videoContainer.innerHTML = "";
  groupedCaptions = []; // Clear previous captions
  transcriptSegmentsData = []; // Clear previous transcript segments
  stopTranscriptSync(); // Stop any previous sync
  clearSearchHighlights(); // Clear previous highlights

  // Show the loading indicator and expand sidebar
  if (loadingIndicator) {
    loadingIndicator.style.display = "block";
    const sidebar = document.getElementById("sidebar");
    if (!sidebar.classList.contains("active")) {
      toggleSidebar(); // Expand sidebar if it's not already active
    }
  } else {
    transcriptContent.innerHTML = "Loading transcript...";
  }

  // Extract video ID
  const videoId = extractVideoId(videoURL);
  if (!videoId) {
    alert("Invalid YouTube URL. Please enter a valid link.");
    if (loadingIndicator) {
      loadingIndicator.style.display = "none";
    }
    transcriptContent.innerHTML = '<p class="error">Invalid YouTube URL</p>';
    return;
  }

  // Display video using YouTube IFrame Player API
  videoContainer.innerHTML = `<div id='player'></div>`;

  // Ensure the YouTube IFrame API script is loaded.
  // This assumes the correct script tag is in index.html as previously discussed.
  // If YT is not defined, the API script wasn't loaded correctly.
  if (typeof YT === "undefined" || typeof YT.Player === "undefined") {
    console.error("YouTube IFrame Player API not loaded.");
    // Fallback or error message if API doesn't load
    if (loadingIndicator) loadingIndicator.style.display = "none";
    transcriptContent.innerHTML =
      '<p class="error">Failed to load YouTube Player API. Please check the script tag.</p>';
    return;
  }

  player = new YT.Player("player", {
    height: "360",
    width: "640",
    videoId: videoId,
    events: {
      onReady: onPlayerReady,
      onStateChange: onPlayerStateChange, // Add state change listener for sync
    },
    playerVars: {
      // Add any player variables here, e.g., 'controls': 0
      playsinline: 1,
    },
  });

  function onPlayerReady(event) {
    console.log("YouTube player is ready");
    // Start the main transcript sync when the player is ready
    startTranscriptSync();
    // Start the draggable caption sync when the player is ready
    startGroupedCaptionSync();
  }

  // Handle player state changes (e.g., play, pause, seeking) for transcript sync
  function onPlayerStateChange(event) {
    // Optionally adjust sync behavior based on state
    // console.log('Player state changed:', event.data);
  }

  try {
    // Call backend to get transcription
    const response = await fetch("/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video_url: videoURL }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Transcription failed");
    }

    const data = await response.json();

    // Store both data structures
    transcriptSegmentsData = data.transcript; // Speaker segments
    groupedCaptions = data.captions; // Timed text segments (for captions and main transcript display)

    // Format the transcript using the combined data
    formatTranscript(transcriptSegmentsData, groupedCaptions);

    startGroupedCaptionSync();

    // Hide the loading indicator after fetch completes
    if (loadingIndicator) {
      loadingIndicator.style.display = "none";
    }
  } catch (error) {
    console.error("Error:", error);
    // Hide the loading indicator on error
    if (loadingIndicator) {
      loadingIndicator.style.display = "none";
    }
    transcriptContent.innerHTML = `<p class="error">Error: ${error.message}</p>`;
  }
}

// Extract YouTube video ID from URL
function extractVideoId(url) {
  if (!url) {
    return null;
  }

  // Regex to extract video ID from various YouTube URL formats
  const regExp =
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?(?:embed\/)?(?:v\/)?(?:live\/)?([a-zA-Z0-9_-]{11})(?:(?:\?|&|\/)errors\=)?(?:[\s\S]*)$/;
  const match = url.match(regExp);

  // The video ID is typically the first capturing group
  return match && match[1] && match[1].length === 11 ? match[1] : null; // Added check for match[1] existence
}

// Update the display format to handle ElevenLabs response
// Modified to use both speaker segments and time-stamped caption segments
function formatTranscript(transcriptSegments, captionSegments) {
  const transcriptContentDiv = document.getElementById("transcript-content");
  transcriptContentDiv.innerHTML = ""; // Clear "Loading..." or previous content

  if (
    !transcriptSegments ||
    !Array.isArray(transcriptSegments) ||
    transcriptSegments.length === 0
  ) {
    transcriptContentDiv.innerHTML = "<p>No transcript available</p>";
    return;
  }

  let html = "";
  let captionIndex = 0; // Pointer for the caption segments array

  transcriptSegments.forEach((speakerSegment) => {
    // Start a new speaker block
    html += `<div class="transcript-speaker-block" data-speaker-start-time="${speakerSegment.start_time}">`;

    // Add speaker label if available
    if (speakerSegment.speaker && speakerSegment.speaker !== "Unknown") {
      html += `
              <div class="transcript-speaker-label">
                  <span class="speaker">${speakerSegment.speaker}:</span>
              </div>
          `;
    }

    // Container for the caption-like text segments within this speaker block
    html += `<div class="caption-like-segments">`;

    // Add caption segments that fall within this speaker segment's time range
    // Assume both arrays are sorted by time
    while (captionIndex < captionSegments.length) {
      const captionSegment = captionSegments[captionIndex];

      // Check if the caption segment starts within the current speaker segment's time frame
      // Allow for slight overlap to avoid missing segments at boundaries
      if (
        captionSegment.start >= speakerSegment.start_time &&
        captionSegment.start < speakerSegment.end_time + 0.1
      ) {
        // Added 0.1s buffer
        // Format timestamp (MM:SS)
        const minutes = Math.floor(captionSegment.start / 60);
        const seconds = Math.floor(captionSegment.start % 60);
        const timestampFormatted = `${minutes
          .toString()
          .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

        // Ensure segment text is treated as a string
        const segmentText = captionSegment.text
          ? String(captionSegment.text)
          : "";

        // Add HTML for the caption-like item
        // Store original text in data-original-text for search/highlighting
        html += `
                  <div class="transcript-caption-item" data-time="${
                    captionSegment.start
                  }" data-end-time="${captionSegment.end}">
                      <a href="#" class="timestamp" data-time="${
                        captionSegment.start
                      }">
                          [${timestampFormatted}]
                      </a>
                      <span class="transcript-caption-text" data-original-text="${segmentText.toLowerCase()}">${segmentText}</span>
                  </div>
              `;
        captionIndex++; // Move to the next caption segment
      } else if (captionSegment.start >= speakerSegment.end_time + 0.1) {
        // If the current caption segment starts after the speaker segment ends,
        // then all subsequent caption segments will also be after.
        // Break the inner loop and move to the next speaker segment.
        break;
      } else {
        // This case might occur if a caption segment somehow starts before the current
        // speaker segment but wasn't included in the previous speaker segment.
        // Or if caption segments don't perfectly align with speaker segments.
        // For simplicity, we'll just move to the next caption segment,
        // but ideally, caption segmentation logic should align better with speaker turns.
        console.warn(
          `Caption segment at ${captionSegment.start}s seems out of place for speaker segment starting at ${speakerSegment.start_time}s`
        );
        captionIndex++; // Still move forward to avoid infinite loop
      }
    }

    html += `</div>`; // Close caption-like-segments container
    html += `</div>`; // Close transcript-speaker-block
  });

  transcriptContentDiv.innerHTML = html;
}

// Convert seconds to MM:SS (Removed the potentially buggy convertToSeconds)
// function convertToSeconds(timestamp) { ... }

// Handle timestamp clicks (for both transcript and chapters)
// This function remains mostly the same, targeting .timestamp class
document.addEventListener("click", function (e) {
  if (
    e.target.classList.contains("timestamp") ||
    e.target.classList.contains("chapter-timestamp")
  ) {
    e.preventDefault();
    // Use parseFloat to ensure data-time is treated as a number
    const seekTime = parseFloat(e.target.getAttribute("data-time"));

    if (player && player.seekTo) {
      player.seekTo(seekTime, true); // Use the player object directly
    } else {
      console.error("YouTube player is not available to seek.");
      // Fallback for older iframe method if player object is somehow missing
      const iframe = document.querySelector("iframe");
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage(
          {
            event: "command",
            func: "seekTo",
            args: [seekTime, true],
          },
          "*"
        );
      }
    }
  }
});

// Removed unused function getVideoTranscription

// SEARCH FUNCTIONALITY
function searchTranscript() {
  const searchInput = document
    .getElementById("search-input")
    .value.trim()
    .toLowerCase(); // Use trim() and toLowerCase() once
  const transcriptCaptionTextElements = document.querySelectorAll(
    ".transcript-caption-text"
  ); // Select the text elements
  const transcriptContentDiv = document.getElementById("transcript-content");

  // Clear previous highlights first
  clearSearchHighlights();

  if (!searchInput) {
    console.log("Search input is empty. Cleared highlights.");
    return;
  }

  let firstMatchElement = null; // Will store the first transcript-caption-item containing a match

  // Create case-insensitive regex for the search term
  const searchRegex = new RegExp(
    `(${searchInput.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
    "gi" // Case-insensitive and global search
  );

  transcriptCaptionTextElements.forEach((textElement) => {
    // Use data-original-text attribute which stores the original lowercase text
    const originalText = textElement.getAttribute("data-original-text");

    if (!textElement || !originalText) {
      // console.warn("Skipping caption text element due to missing original text attribute.");
      return; // Skip if element or data is missing
    }

    // Check if the original text contains the search input string
    if (originalText.includes(searchInput)) {
      // Apply the highlighting regex to the text content of the span element
      // Note: We are replacing within textElement.textContent but setting innerHTML.
      // This is important to ensure we don't re-process already added spans.
      const highlightedHtml = originalText.replace(
        searchRegex,
        '<span class="highlight">$1</span>'
      );

      textElement.innerHTML = highlightedHtml;

      // Keep track of the first match element (the parent .transcript-caption-item)
      if (!firstMatchElement) {
        firstMatchElement = textElement.closest(".transcript-caption-item");
      }
    }
    // No need for an else block here, clearSearchHighlights already reset the innerHTML
  });

  // Scroll the first matching transcript item into view
  if (firstMatchElement) {
    console.log("Scrolling first match into view.");
    // Scroll the parent speaker block into view for better context
    firstMatchElement
      .closest(".transcript-speaker-block")
      .scrollIntoView({ behavior: "smooth", block: "center" });
  } else {
    console.log("No matches found in transcript.");
  }
}

// Clear highlights
function clearSearchHighlights() {
  // Select all elements that might contain highlight spans (.transcript-caption-text)
  document
    .querySelectorAll(".transcript-caption-text")
    .forEach((textElement) => {
      const originalText = textElement.getAttribute("data-original-text");
      // Restore original text content using innerHTML to remove any HTML spans
      if (originalText !== null) {
        // Check for null explicitly
        textElement.innerHTML = originalText; // Use innerHTML as it was set with HTML before
      }
    });
  // Also remove the 'active' class from caption items used for sync highlight
  document
    .querySelectorAll(".transcript-caption-item.active")
    .forEach((item) => {
      item.classList.remove("active");
    });
}

// CAPTION BOX FUNCTIONALITY
function toggleCaptions() {
  captionBox = document.getElementById("caption-box");
  const toggleBtn = document.getElementById("toggle-captions-btn");

  if (captionBox.style.display === "none" || captionBox.style.display === "") {
    captionBox.style.display = "block";
    toggleBtn.textContent = "Disable Captions";
  } else {
    captionBox.style.display = "none";
    toggleBtn.textContent = "Enable Captions";
    // Clear caption box text when hiding
    document.getElementById("caption-text").innerText = "";
    // Stop the caption box sync when hiding
    stopGroupedCaptionSync();
  }
}

function closeCaptionBox() {
  captionBox = document.getElementById("caption-box");
  const toggleBtn = document.getElementById("toggle-captions-btn");

  captionBox.style.display = "none";
  toggleBtn.textContent = "Enable Captions";
  // Clear caption box text
  document.getElementById("caption-text").innerText = "";
  // Stop the caption box sync
  stopGroupedCaptionSync();
}

function startDrag(e) {
  captionBox = document.getElementById("caption-box");
  isDragging = true;

  // Calculate offset relative to the element's current position
  const boxRect = captionBox.getBoundingClientRect();
  dragOffsetX = e.clientX - boxRect.left;
  dragOffsetY = e.clientY - boxRect.top;

  document.addEventListener("mousemove", dragCaptionBox);
  document.addEventListener("mouseup", stopDrag);
  // Prevent default text selection or dragging issues
  document.body.style.userSelect = "none";
  document.body.style.cursor = "move";
}

function dragCaptionBox(e) {
  if (!isDragging || !captionBox) return;

  // Calculate the new position
  let newLeft = e.clientX - dragOffsetX;
  let newTop = e.clientY - dragOffsetY;

  // Optional: Add boundaries to prevent dragging off-screen
  const containerRect = document.body.getBoundingClientRect(); // Use body as the boundary
  const boxRect = captionBox.getBoundingClientRect();

  newLeft = Math.max(0, Math.min(newLeft, containerRect.width - boxRect.width));
  newTop = Math.max(0, Math.min(newTop, containerRect.height - boxRect.height));

  captionBox.style.left = `${newLeft}px`;
  captionBox.style.top = `${newTop}px`;
  captionBox.style.position = "fixed"; // Use fixed positioning for dragging relative to viewport
}

function stopDrag() {
  isDragging = false;
  document.removeEventListener("mousemove", dragCaptionBox);
  document.removeEventListener("mouseup", stopDrag);
  document.body.style.userSelect = ""; // Restore user select
  document.body.style.cursor = ""; // Restore cursor
}

function startGroupedCaptionSync() {
  // Stop any existing interval first
  // stopGroupedCaptionSync();

  const captionTextBox = document.getElementById("caption-text");

  if (!captionTextBox || !groupedCaptions.length || !player) return;

  groupedCaptionSyncInterval = setInterval(() => {
    const currentTime = player.getCurrentTime();

    // Find the caption segment that is currently active
    const currentCaption = groupedCaptions.find(
      (cap) => currentTime >= cap.start && currentTime <= cap.end
    );

    if (currentCaption) {
      captionTextBox.innerText = currentCaption.text;
    } else {
      captionTextBox.innerText = ""; // Clear text if no caption is active
    }
  }, 200); // Reduced interval for potentially smoother updates
}

// function stopGroupedCaptionSync() {
//   if (groupedCaptionSyncInterval) {
//     clearInterval(groupedCaptionSyncInterval);
//     groupedCaptionSyncInterval = null;
//   }
// }

// MAIN TRANSCRIPT SYNC (Sidebar)
let transcriptSyncInterval = null;
let lastHighlightedItem = null; // Keep track of the last highlighted item

function startTranscriptSync() {
  // Stop any existing interval first
  stopTranscriptSync();

  const transcriptItems = document.querySelectorAll(".transcript-caption-item");
  if (!transcriptItems.length || !player) return;

  transcriptSyncInterval = setInterval(() => {
    const currentTime = player.getCurrentTime();

    // Find the current caption item based on video time
    let currentItem = null;
    for (let i = 0; i < transcriptItems.length; i++) {
      const item = transcriptItems[i];
      const startTime = parseFloat(item.getAttribute("data-time"));
      const endTime = parseFloat(item.getAttribute("data-end-time"));

      // Check if current time is within the item's time range
      if (currentTime >= startTime && currentTime < endTime) {
        currentItem = item;
        break; // Found the current item, no need to check further
      }
    }

    // Highlight the current item and unhighlight the previous one
    if (currentItem && currentItem !== lastHighlightedItem) {
      if (lastHighlightedItem) {
        lastHighlightedItem.classList.remove("active");
      }
      currentItem.classList.add("active");
      lastHighlightedItem = currentItem;

      // Optional: Scroll the active item into view if it's not visible
      // Check if the item is in the viewport of its scrollable parent (.transcript-content)
      const transcriptContent = document.getElementById("transcript-content");
      const itemRect = currentItem.getBoundingClientRect();
      const containerRect = transcriptContent.getBoundingClientRect();

      const isVisible =
        itemRect.top >= containerRect.top &&
        itemRect.bottom <= containerRect.bottom;

      if (!isVisible) {
        // Scroll the item into the middle of the view
        currentItem.scrollIntoView({ behavior: "auto", block: "center" });
      }
    } else if (!currentItem && lastHighlightedItem) {
      // If no item is currently active (e.g., during pauses or gaps)
      // and there was a previously highlighted item, unhighlight it.
      lastHighlightedItem.classList.remove("active");
      lastHighlightedItem = null;
    }
  }, 100); // Check every 100ms
}

function stopTranscriptSync() {
  if (transcriptSyncInterval) {
    clearInterval(transcriptSyncInterval);
    transcriptSyncInterval = null;
    // Also remove highlight from any currently highlighted item
    if (lastHighlightedItem) {
      lastHighlightedItem.classList.remove("active");
      lastHighlightedItem = null;
    }
  }
}

// Attach event listener to search input
// document
//   .getElementById("search-input")
//   .addEventListener("input", searchTranscript);

// Listen for the YouTube IFrame API ready event
// This function is called automatically by the API script
function onYouTubeIframeAPIReady() {
  console.log("YouTube IFrame API is ready.");
  // The player is created inside loadVideo, so sync starts in onPlayerReady
}

// Ensure the onYouTubeIframeAPIReady function is globally accessible
window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;
