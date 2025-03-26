from flask import Flask, request, jsonify
import assemblyai as aai
import yt_dlp
import os
from tempfile import mkdtemp
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__, static_folder='.', static_url_path='')

# Verify API key is loaded
ASSEMBLYAI_API_KEY = os.getenv('ASSEMBLY_AI_API')
if not ASSEMBLYAI_API_KEY:
    raise ValueError("No AssemblyAI API key found. Please set ASSEMBLYAI_API_KEY in .env file")

# Configure AssemblyAI with the environment variable
aai.settings.api_key = ASSEMBLYAI_API_KEY

# Custom vocabulary for better recognition
CUSTOM_VOCAB = [
    "AssemblyAI", "YouTube", "Flask", "Python",
    "transcription", "timestamp", "API", "backend"
]

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
        # Download and enhance audio
        temp_dir = mkdtemp()
        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': os.path.join(temp_dir, 'audio.%(ext)s'),
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
            'postprocessor_args': [
                '-af', 'highpass=f=200,lowpass=f=3000,afftdn=nf=-25',
                '-ar', '16000'
            ],
            'ffmpeg_location': os.getenv('FFMPEG_PATH', 'ffmpeg')
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=True)
            audio_file = ydl.prepare_filename(info).replace('.webm', '.mp3').replace('.m4a', '.mp3')

        # Enhanced transcription config
        config = aai.TranscriptionConfig(
            language_code="en",
            punctuate=True,
            format_text=True,
            disfluencies=False,
            speaker_labels=True,
            auto_chapters=True,
            speech_threshold=0.5,
            # custom_vocabulary=CUSTOM_VOCAB
        )

        transcriber = aai.Transcriber()
        transcript = transcriber.transcribe(audio_file, config=config)
        
        if transcript.error:
            return jsonify({"error": transcript.error}), 500

        # Format results with timestamps from utterances
        formatted_lines = []
        for utterance in transcript.utterances:
            start_sec = utterance.start // 1000
            timestamp = f"{start_sec // 60:02d}:{start_sec % 60:02d}"
            formatted_lines.append({
                'timestamp': timestamp,
                'speaker': f"Speaker {utterance.speaker}",
                'text': utterance.text
            })

        chapters = []
        if hasattr(transcript, 'chapters'):
            for chapter in transcript.chapters:
                start_sec = chapter.start // 1000
                chapters.append({
                    'timestamp': f"{start_sec // 60:02d}:{start_sec % 60:02d}",
                    'title': chapter.headline,
                    'summary': chapter.summary
                })

        # Clean up
        if os.path.exists(audio_file):
            os.remove(audio_file)
        os.rmdir(temp_dir)
        
        return jsonify({
            'transcript': formatted_lines,
            'audio_enhancements': ydl_opts['postprocessor_args'],
            'chapters': chapters,
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)