from flask import Flask, request, jsonify, render_template
import assemblyai as aai
import yt_dlp
import os
from tempfile import mkdtemp
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__, static_folder='.', static_url_path='')

# Configure AssemblyAI
aai.settings.api_key = os.getenv('ASSEMBLY_AI_API')  # Replace with your actual API key

if not aai.settings.api_key:
    raise ValurError("No AssemblyAI API key found. Please set ASSEMBLYAI_API_KEY in .env file")

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
        # Download audio using yt-dlp
        temp_dir = mkdtemp()
        # Add to your Python code before ydl_opts
        os.environ['PATH'] += os.pathsep + 'C:/ffmpeg/ffmpeg-2025-03-24-git-cbbc927a67-full_build/bin'
        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': os.path.join(temp_dir, 'audio.%(ext)s'),
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
            'ffmpeg_location': 'C:/ffmpeg/ffmpeg-2025-03-24-git-cbbc927a67-full_build/bin/ffmpeg.exe'
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([video_url])
        
        audio_file = os.path.join(temp_dir, 'audio.mp3')
        
        # Transcribe with AssemblyAI
        transcriber = aai.Transcriber()
        transcript = transcriber.transcribe(audio_file)
        
        if transcript.error:
            return jsonify({"error": transcript.error}), 500
        
        # Clean up
        os.remove(audio_file)
        os.rmdir(temp_dir)
        
        return jsonify({
            "transcript": transcript.text
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)