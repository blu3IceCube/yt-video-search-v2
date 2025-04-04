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

  // Clear previous content
  videoContainer.innerHTML = "";
  transcriptContent.innerHTML = '<p class="loading">Loading transcript...</p>';
  chaptersContainer.innerHTML = "";

  // Extract video ID
  const videoId = extractVideoId(videoURL);

  if (!videoId) {
    alert("Invalid YouTube URL. Please enter a valid link.");
    transcriptContent.innerHTML = '<p class="error">Invalid YouTube URL</p>';
    return;
  }

  // Display video
  videoContainer.innerHTML = `
      <iframe 
          src="https://www.youtube.com/embed/${videoId}" 
          frameborder="0" 
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
          allowfullscreen>
      </iframe>
  `;

  try {
    // Call backend to get transcription
    const response = await fetch("/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        video_url: `https://www.youtube.com/watch?v=${videoId}`,
      }),
    });

    if (!response.ok) throw new Error("Transcription failed");

    const data = await response.json();

    // Display transcript with timestamps
    transcriptContent.innerHTML = formatTranscript(data.transcript);

    // Display chapters if available
    if (data.chapters && data.chapters.length > 0) {
      displayChapters(data.chapters);
    }
  } catch (error) {
    console.error("Error:", error);
    transcriptContent.innerHTML = `<p class="error">Error: ${error.message}</p>`;
  }
}

// Extract YouTube video ID from URL
function extractVideoId(url) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

// Format transcript with clickable timestamps and speaker labels
function formatTranscript(transcript) {
  if (!transcript || !transcript.length) {
    return '<p class="no-transcript">No transcript available</p>';
  }

  return transcript
    .map(
      (item) => `
    <div class="transcript-item">
      <div class="transcript-meta">
        <a href="#" class="timestamp" data-time="${convertToSeconds(
          item.timestamp
        )}">
          [${item.timestamp}]
        </a>
        <span class="speaker">${item.speaker}:</span>
      </div>
      <p class="transcript-text">${item.text}</p>
    </div>
  `
    )
    .join("");
}

function displayChapters(chapters) {
  const container = document.getElementById("chapters-container");
  container.innerHTML = `
    <h3 class="chapters-title">Chapters</h3>
    ${chapters
      .map(
        (chapter) => `
      <div class="chapter">
        <a href="#" class="chapter-timestamp" data-time="${convertToSeconds(
          chapter.timestamp
        )}">
          ${chapter.timestamp}
        </a>
        <h4>${chapter.title}</h4>
        <p>${chapter.summary}</p>
      </div>
    `
      )
      .join("")}
  `;
}

// Convert MM:SS to seconds
function convertToSeconds(timestamp) {
  const [minutes, seconds] = timestamp.split(":").map(Number);
  return minutes * 60 + seconds;
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

// Enhanced loading with retries
async function getVideoTranscription(videoId, retries = 2) {
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
    if (retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return getVideoTranscription(videoId, retries - 1);
    }
    throw error;
  }
}
