function loadVideo() {
  const videoURL = document.getElementById("yt-url-input").value;
  const videoContainer = document.getElementById("video-container");

  // Extract video ID from URL (supports multiple URL formats)
  const videoId = extractVideoId(videoURL);

  if (videoId) {
    // Embed the YouTube video using an iframe
    videoContainer.innerHTML = `
          <iframe 
              width="100%" 
              height="100%"
              src="https://www.youtube.com/embed/${videoId}" 
              frameborder="0" 
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
              allowfullscreen>
          </iframe>
      `;
  } else {
    alert("Invalid YouTube URL. Please enter a valid link.");
  }
}

// Helper function to extract video ID from different YouTube URL formats
function extractVideoId(url) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);

  return match && match[2].length === 11 ? match[2] : null;
}
