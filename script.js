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

  // Clear previous content
  videoContainer.innerHTML = "";
  transcriptContent.innerHTML = '<p class="loading">Loading transcript...</p>';

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
    const transcript = await getVideoTranscription(videoId);

    if (transcript) {
      transcriptContent.innerHTML = formatTranscript(transcript);
    } else {
      transcriptContent.innerHTML =
        '<p class="error">No transcript available</p>';
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

// Format transcript text for display
function formatTranscript(transcript) {
  if (!transcript) return "<p>No transcript available</p>";
  return `<div class="transcript-text">${transcript.replace(
    /\n/g,
    "<br>"
  )}</div>`;
}

// Fetch transcription from backend
async function getVideoTranscription(videoId) {
  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

  try {
    const response = await fetch("http://127.0.0.1:5000/transcribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ video_url: youtubeUrl }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Transcription failed");
    }

    const data = await response.json();
    return data.transcript;
  } catch (error) {
    console.error("Fetch error:", error);
    throw new Error("Failed to get transcription: " + error.message);
  }
}
