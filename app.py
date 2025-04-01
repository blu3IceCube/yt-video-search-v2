from flask import Flask, request, jsonify
import os
from io import BytesIO
from tempfile import mkdtemp
import yt_dlp
from elevenlabs.client import ElevenLabs
from dotenv import load_dotenv

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
    video_url = data.get('video_url')
    
    if not video_url:
        return jsonify({"error": "No URL provided"}), 400
    
    try:
        # Download audio
        temp_dir = mkdtemp()
        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': os.path.join(temp_dir, 'audio.%(ext)s'),
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
            'ffmpeg_location': os.getenv('FFMPEG_PATH', 'ffmpeg')
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=True)
            audio_file = ydl.prepare_filename(info).replace('.webm', '.mp3').replace('.m4a', '.mp3')

        # Read audio data
        with open(audio_file, 'rb') as f:
            audio_data = BytesIO(f.read())

        # Transcribe audio using ElevenLabs
        transcription = client.speech_to_text.convert(
            file=audio_data,
            model_id="scribe_v1",
            diarize=True,  # Enable speaker diarization
            tag_audio_events=True  # Tag non-speech audio events
        )
        
        # Format transcript with timestamps and speaker labels
        # formatted_transcript = []
        # for word_info in transcription.words:
        #     start_sec = word_info.start
        #     timestamp = f"{int(start_sec // 60):02d}:{int(start_sec % 60):02d}"
        #     speaker = word_info.speaker_id
        #     text = word_info.text
        #     formatted_transcript.append({
        #         'timestamp': timestamp,
        #         'speaker': f"Speaker {speaker}",
        #         'text': text
        #     })

        # Clean up
        os.remove(audio_file)
        os.rmdir(temp_dir)
        
        # return jsonify({'transcript': formatted_transcript})
        return jsonify({'transcript': str(transcription.text)})
        
    except Exception as e:
        print("Error:", str(e))  # Print error for debugging
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000)