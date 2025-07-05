from flask import Flask, request, jsonify
import os
from io import BytesIO
from tempfile import mkdtemp
import yt_dlp
from elevenlabs.client import ElevenLabs
from dotenv import load_dotenv
import glob

load_dotenv()

app = Flask(__name__, static_folder='.', static_url_path='')

# Verify API key is loaded
ELEVENLABS_API_KEY = os.getenv('ELEVENLABS_API_KEY')
if not ELEVENLABS_API_KEY:
    raise ValueError("No ElevenLabs API key found. Please set ELEVENLABS_API_KEY in the .env file.")

# Initialize ElevenLabs client
client = ElevenLabs(api_key=ELEVENLABS_API_KEY)

@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/transcribe', methods=['POST'])
def transcribe():
    data = request.json
    print(f"data from app.py {data}")
    video_url = data.get('video_url')

    # print(f"data from app.py {data}")
    
    if not video_url:
        return jsonify({"error": "No URL provided"}), 400

    temp_dir = None
    audio_file = None
    try:
        # Step 1: Create temp directory
        temp_dir = mkdtemp()
        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': os.path.join(temp_dir, 'audio.%(ext)s'),
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
            'ffmpeg_location': os.getenv('FFMPEG_PATH', 'ffmpeg'),
            'quiet': True,
            'extract_flat': 'discard_key'
        }

        info_dict = None
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info_dict = ydl.extract_info(video_url, download=True)

        # Step 2: Find the MP3 file in temp_dir
        mp3_files = glob.glob(os.path.join(temp_dir, "*.mp3"))
        if not mp3_files:
            raise FileNotFoundError("MP3 file not found after download.")
        
        audio_file = mp3_files[0]  # Use the first .mp3 file found

        # Step 3: Read audio data
        with open(audio_file, 'rb') as f:
            audio_data = BytesIO(f.read())

        # Transcribe audio using ElevenLabs
        transcription = client.speech_to_text.convert(
            file=audio_data,
            model_id="scribe_v1",
            diarize=True,  # Enable speaker diarization
            tag_audio_events=True,  # Tag non-speech audio events
            timestamps_granularity='word', # Request word-level timestamps
        )
        
        # Step 4: Format transcript with timestamps and speaker labels from word-level data
        # ElevenLabs scribe_v1 with word_timestamps=True returns a list of Word objects
        # Each Word object has text, start, end, and speaker_id
        formatted_transcript = []
        # Check if transcription is valid and has iterable words
        if transcription and hasattr(transcription, 'words') and transcription.words is not None and len(transcription.words) > 0:
           current_segment = None
           # Group words into segments based on speaker or short pauses
           for word in transcription.words:
               # Basic check to ensure word object has necessary attributes
               if not hasattr(word, 'start') or not hasattr(word, 'end') or not hasattr(word, 'speaker_id') or not hasattr(word, 'text'):
                   print(f"Skipping word due to missing attributes: {word}")
                   continue # Skip this word if it's malformed

               # If it's the first word or speaker changed or a significant pause
               prev_end_time = current_segment['end_time'] if current_segment else 0
               if not current_segment or (current_segment['speaker'] != f"Speaker {word.speaker_id}") or (word.start - prev_end_time > 1.5): # Increased pause threshold slightly
                    if current_segment:
                        formatted_transcript.append(current_segment)

                    # Start a new segment
                    current_segment = {
                        'start_time': word.start,
                        'end_time': word.end, # Initialize with the word's end time
                        'speaker': f"Speaker {word.speaker_id}",
                        'text': word.text
                    }
               else:
                   # Add word to current segment
                   current_segment['text'] += " " + word.text
                   current_segment['end_time'] = word.end # Update segment end time

           # Add the last segment if it exists
           if current_segment:
                formatted_transcript.append(current_segment)

        elif transcription and hasattr(transcription, 'text') and transcription.text:
            # Fallback: If word timestamps are not available but simple text is,
            # create a single segment with the full text.
            print("Word-level transcription not available. Falling back to simple text.")
            formatted_transcript = [{'start_time': 0, 'end_time': 0, 'speaker': 'Unknown', 'text': transcription.text}]

        else:
            # Neither word-level nor simple text transcription is available
            print("Transcription failed: No word-level or simple text available from ElevenLabs.")
            # Return an empty list for transcript
            formatted_transcript = [] # Ensure frontend gets an empty list

        # Clean up temporary files and directory
        if audio_file and os.path.exists(audio_file):
            os.remove(audio_file)
        if temp_dir and os.path.exists(temp_dir):
             try:
                 # Check if directory is empty before removing
                 if not os.listdir(temp_dir):
                      os.rmdir(temp_dir)
                 else:
                      # If not empty, print warning or handle
                      print(f"Temporary directory not empty: {temp_dir}")
                      # You might want a more aggressive cleanup if needed
             except OSError as e:
                 print(f"Error removing temporary directory {temp_dir}: {e}")

        grouped_captions = []
        group = {"text": "", "start": None, "end": None}

        for i, word in enumerate(transcription.words):
            if group["start"] is None:
                group["start"] = word.start

            group["text"] += (" " if group["text"] else "") + word.text
            group["end"] = word.end

            # Group by 2 seconds or 10 words
            next_word = transcription.words[i+1] if i+1 < len(transcription.words) else None
            if (group["end"] - group["start"] >= 8.0) or (i % 30 == 19) or not next_word:
                grouped_captions.append(group)
                group = {"text": "", "start": None, "end": None}


        # print(f"captions_format {grouped_captions}")

        return jsonify({
            'transcript': formatted_transcript,
            'captions': grouped_captions
            })

    except Exception as e:
        print("Error:", str(e))  # Print error for debugging
        # Clean up temp directory if it was created before the error
        if temp_dir and os.path.exists(temp_dir):
            try:
                 # Clean up any remaining files before removing directory
                 for file in glob.glob(os.path.join(temp_dir, "*")):
                     try:
                         os.remove(file)
                     except OSError as file_cleanup_error:
                         print(f"Error cleaning up file {file}: {file_cleanup_error}")
                 os.rmdir(temp_dir)
            except OSError as cleanup_error:
                print(f"Error during temp directory cleanup {temp_dir}: {cleanup_error}")

        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000)