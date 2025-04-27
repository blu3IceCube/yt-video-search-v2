// script.js - Complete Updated Version

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
  const chaptersContainer = document.getElementById("chapters-container");
  const loadingIndicator = document.getElementById("loading-indicator"); // Get the loading indicator element

  // Clear previous content
  videoContainer.innerHTML = "";

  // Show the loading indicator
  if (loadingIndicator) {
    console.log("Showing loading indicator...");
    loadingIndicator.style.display = "block";
    // Optional: You might want to clear transcriptContent.innerHTML here too
    // transcriptContent.innerHTML = '';

    // Automatically expand sidebar when loading starts
    const sidebar = document.getElementById("sidebar");
    if (!sidebar.classList.contains("active")) {
      toggleSidebar(); // Expand sidebar if it's not already active
    }
  } else {
    console.warn("Loading indicator element not found!");
    transcriptContent.innerHTML = "Loading transcript...";
  }

  // Show the loading indicator
  if (loadingIndicator) {
    console.log("Showing loading indicator..."); // Confirm show logic is reached
    loadingIndicator.style.display = "block";
    // Optionally clear previous text messages if any
    // transcriptContent.innerHTML = ''; // If you want ONLY the spinner visible
  } else {
    console.warn("Loading indicator element not found!"); // Log if element wasn't found
    // Fallback for debugging if element not found
    transcriptContent.innerHTML = "Loading transcript...";
  }

  // Extract video ID
  const videoId = extractVideoId(videoURL);
  if (!videoId) {
    alert("Invalid YouTube URL. Please enter a valid link.");
    // Hide the loading indicator
    if (loadingIndicator) {
      console.log("Hiding loading indicator due to invalid URL."); // Confirm hide logic
      loadingIndicator.style.display = "none";
    }
    transcriptContent.innerHTML = '<p class="error">Invalid YouTube URL</p>';
    return;
  }

  // Display video
  videoContainer.innerHTML = `
      <iframe
          src="http://www.youtube.com/embed/${videoId}?enablejsapi=1"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen>
      </iframe>`;

  // Keep the debug info open until fetch results
  // console.log("Initiating fetch request..."); // Optional log

  try {
    // Call backend to get transcription
    const response = await fetch("/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video_url: videoURL }),
    });

    // Hide the loading indicator after fetch completes
    if (loadingIndicator) {
      console.log("Hiding loading indicator after fetch success."); // Confirm hide logic
      loadingIndicator.style.display = "none";
    }

    // ... (rest of try block for processing response) ...
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Transcription failed");
    }

    const data = await response.json();

    formatTranscript(data.transcript);
    // Removed chapters logic
  } catch (error) {
    console.error("Error:", error);
    // Hide the loading indicator on error
    if (loadingIndicator) {
      console.log("Hiding loading indicator on fetch error."); // Confirm hide logic
      loadingIndicator.style.display = "none";
    }
    transcriptContent.innerHTML = `<p class="error">Error: ${error.message}</p>`;
  } finally {
    // Ensure debug logging ends whether success or error
  }
}

// Extract YouTube video ID from URL
function extractVideoId(url) {
  // const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  // const match = url.match(regExp);
  // return match && match[2].length === 11 ? match[2] : null;

  if (!url) {
    return null;
  }

  // Regex to extract video ID from various YouTube URL formats
  const regExp =
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?(?:embed\/)?(?:v\/)?(?:live\/)?([a-zA-Z0-9_-]{11})(?:(?:\?|&|\/)errors\=)?(?:[\s\S]*)$/;
  const match = url.match(regExp);

  // The video ID is typically the first capturing group
  return match && match[1].length === 11 ? match[1] : null;
}

// Update the display format to handle ElevenLabs response
function formatTranscript(transcriptSegments) {
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
  transcriptSegments.forEach((segment) => {
    // Calculate MM:SS timestamp for display
    const minutes = Math.floor(segment.start_time / 60);
    const seconds = Math.floor(segment.start_time % 60);
    const timestampFormatted = `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;

    // Ensure segment text is treated as a string and handle potential null/undefined
    const segmentText = segment.text ? String(segment.text) : "";

    // Generate HTML for each transcript item
    // Include data-text attribute for search and data-time for seeking
    html += `
          <div class="transcript-item" data-text="${segmentText.toLowerCase()}" data-time="${
      segment.start_time
    }">
              <div class="transcript-meta">
                  <a href="#" class="timestamp" data-time="${
                    segment.start_time
                  }">
                      [${timestampFormatted}]
                  </a>
                  ${
                    segment.speaker
                      ? `<span class="speaker">${segment.speaker}:</span>`
                      : ""
                  }
              </div>
              <p class="transcript-text">${segmentText}</p>
          </div>
      `;
  });

  transcriptContentDiv.innerHTML = html;
}

// Convert MM:SS to seconds
function convertToSeconds(timestamp) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

// Handle timestamp clicks (for both transcript and chapters)
document.addEventListener("click", function (e) {
  if (
    e.target.classList.contains("timestamp") ||
    e.target.classList.contains("chapter-timestamp")
  ) {
    e.preventDefault();
    const seekTime = e.target.getAttribute("data-time");
    const iframe = document.querySelector("iframe");

    if (iframe) {
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
});

// Only need to update the API endpoint reference
async function getVideoTranscription(videoId) {
  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
  try {
    const response = await fetch("/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video_url: youtubeUrl }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Transcription failed");
    }

    return await response.json();
  } catch (error) {
    console.error("ElevenLabs Error:", error);
    throw new Error(`Transcription failed: ${error.message}`);
  }
}

// SEARCH FUNCTIONALITY
function searchTranscript() {
  const searchInput = document.getElementById("search-input").value.trim(); // Use trim()
  const transcriptItems = document.querySelectorAll(".transcript-item");
  const transcriptContentDiv = document.getElementById("transcript-content"); // Reference to the main content div

  // --- START DEBUGGING PRINTS FOR SEARCH ---
  console.log("\n--- Search Debug Info ---");
  console.log(`Search triggered. Input: "${searchInput}"`);
  console.log(`Found ${transcriptItems.length} transcript items.`);
  // --- END DEBUGGING PRINTS FOR SEARCH ---

  // Clear previous highlights first
  clearSearchHighlights(); // This function will now just remove the spans

  if (!searchInput) {
    // If search input is empty after clearing, just return
    console.log("Search input is empty. Cleared highlights.");
    console.log("--- END Search Debug Info ---\n");
    return;
  }

  let matchFoundOverall = false; // Flag to track if any match was found in the entire transcript
  let firstMatchElement = null;
  // Create case-insensitive regex for the search term
  // Escapes special regex characters in the input string
  const searchRegex = new RegExp(
    `(${searchInput.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
    "gi"
  );

  transcriptItems.forEach((item) => {
    const transcriptTextElement = item.querySelector(".transcript-text");
    // Use data-text attribute which stores the original lowercase text
    const originalText = item.getAttribute("data-text");

    if (!transcriptTextElement || !originalText) {
      console.warn(
        "Skipping transcript item due to missing text element or data-text attribute."
      );
      return; // Skip if element or data is missing
    }

    // --- DEBUGGING PRINT FOR EACH ITEM ---
    // console.log(`Checking item with data-text: "${originalText.substring(0, 100)}..." for "${searchInput}"`); // Print start of text
    // --- END DEBUGGING PRINT FOR EACH ITEM ---

    // Check if the original text contains the search input (case-insensitive)
    if (originalText.includes(searchInput.toLowerCase())) {
      // If a match is found in this segment's original text,
      // apply the highlighting regex to the text content of the paragraph element.
      // Note: We are replacing within transcriptTextElement.textContent but setting innerHTML.
      // This is important to ensure we don't re-process already added spans.
      // The replace method on a string works on a copy.
      const highlightedHtml = originalText.replace(
        searchRegex,
        '<span class="highlight">$1</span>'
      );

      transcriptTextElement.innerHTML = highlightedHtml;

      // --- DEBUGGING PRINT FOR MATCH ---
      console.log(`Match found in segment. Setting innerHTML.`);
      // console.log(`Resulting HTML (partial): "${highlightedHtml.substring(0, 200)}..."`);
      // --- END DEBUGGING PRINT FOR MATCH ---

      // Keep track of the first match element for scrolling
      if (!matchFoundOverall) {
        firstMatchElement = item;
        matchFoundOverall = true; // Set flag since a match was found
      }
    } else {
      // If no match, ensure the text is its original form (no highlights from previous searches)
      // This is handled by clearSearchHighlights at the start, but re-setting textContent here
      // ensures it if clearSearchHighlights was somehow skipped or partial.
      transcriptTextElement.textContent = originalText;
    }
  });

  // Scroll the first matching transcript item into view
  if (firstMatchElement) {
    console.log("Scrolling first match into view.");
    firstMatchElement.scrollIntoView({ behavior: "smooth", block: "center" });
  } else {
    console.log("No matches found in transcript.");
  }
  console.log("--- END Search Debug Info ---\n");
}

// Clear highlights when search is empty
function clearSearchHighlights() {
  console.log("Clearing search highlights.");
  document.querySelectorAll(".transcript-item").forEach((item) => {
    const transcriptTextElement = item.querySelector(".transcript-text");
    const originalText = item.getAttribute("data-text");

    // Restore original text content using textContent to remove any HTML spans
    if (transcriptTextElement && originalText !== null) {
      // Check for null explicitly
      transcriptTextElement.textContent = originalText;
    }
    // Ensure the item itself doesn't have the main highlight class (from old logic)
    item.classList.remove("highlight"); // Remove the old item highlight class
  });
}

// Attach event listener to search input
document
  .getElementById("search-input")
  .addEventListener("input", searchTranscript);
