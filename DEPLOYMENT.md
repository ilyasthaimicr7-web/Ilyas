# Horror Studio AI - Deployment Guide

## Overview
Horror Studio AI is a Node.js Express web application that generates AI-powered horror stories and videos. It runs as a server serving static files and providing API endpoints.

## Prerequisites
- Node.js 20+ installed
- FFmpeg 7.x installed (for video generation)
- Free-tier API keys (optional, but recommended for full functionality)

## Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Configure environment variables (see below)
4. Start the server:
```bash
npm start
```

## Environment Variables

Create a `.env` file in the root directory or set these environment variables:

| Variable | Required | Default | Description |
|---|---|---|---|
| PORT | No | 8123 | The port the server listens on |
| NODE_ENV | No | development | Environment mode |
| GEMINI_API_KEY | Recommended | - | Google Gemini API key for story/metadata generation. Get from https://aistudio.google.com/apikey (free tier available) |
| GEMINI_MODEL | No | gemini-2.0-flash | Gemini model to use |
| HF_API_KEY | Optional | - | Hugging Face API key for AI image/TTS. Get from https://huggingface.co/settings/tokens (free tier available). Without it, fallback mode is used. |

**Security Notes:**
- API keys are stored server-side only and never exposed to the frontend
- `.env` is in `.gitignore` - never commit your keys
- In production, set environment variables through your hosting provider's dashboard

## Startup

```bash
npm start
```

The app will start listening on the port specified by `PORT` (falls back to 8123). It binds to `0.0.0.0` so it's accessible on all network interfaces.

## Project Structure

```
/workspace/app
├── server.js      # Express server, API endpoints, video pipeline
├── index.html     # Frontend UI
├── css/style.css  # Styles
├── js/app.js      # Frontend logic
├── lib/           # Server-side modules
├── assets/        # Static assets (music, sfx)
├── videos/        # Generated video output (gitignored)
└── package.json   # Dependencies and scripts
```

## Features & Limitations

### What works without API keys
- Text-only fallback video generation (renders story as text with ambient audio)
- Basic UI functionality
- Server health endpoints

### What requires API keys
- AI story generation, YouTube metadata (requires GEMINI_API_KEY)
- AI image generation, AI narration (requires HF_API_KEY; Pollinations fallback attempted where available)
- Full cinematic video pipeline with AI-generated scenes

## Video Generation

The app can generate videos in two modes:
1. **Full AI mode** (requires HF_API_KEY): AI images + AI narration + subtitles + ambient audio → MP4 via FFmpeg
2. **Fallback mode** (no HF_API_KEY): Text-on-screen + ambient audio → MP4 via FFmpeg

Videos are saved to `videos/temp/<jobId>/` during processing and served from `videos/<jobId>/final.mp4`.

## Deployment Considerations

- **Ephemeral storage**: Some hosting providers (serverless) have ephemeral filesystems. Videos generated during a request may not persist after the request ends. For persistent storage, configure external storage (S3, etc.) and modify the video serving logic.
- **Timeouts**: Video generation can take 30-120+ seconds. Ensure your hosting provider allows long request timeouts (or use background job processing).
- **FFmpeg**: FFmpeg must be available in the deployment environment. Most container-based hosts (Railway, Render, Fly.io with custom Docker) support FFmpeg; some serverless platforms may not.
- **Memory/CPU**: Video rendering is CPU-intensive. Allocate sufficient resources.
- **Dependencies**: All dependencies listed in package.json are required.

## Health Checks

- `GET /api/health` - Server status and API key configuration
- `GET /api/video/health` - Video pipeline status (FFmpeg, AI service availability)

## API Endpoints

- `POST /api/generate/video` - Start video generation (returns jobId)
- `GET /api/video/status/:jobId` - Check job progress
- `GET /videos/:jobId/final.mp4` - Download generated video
- `POST /api/generate/story` - Generate story (requires GEMINI_API_KEY)
- `POST /api/generate/youtube` - Generate YouTube metadata (requires GEMINI_API_KEY)

## Troubleshooting

| Issue | Solution |
|---|---|
| FFmpeg not found | Ensure FFmpeg is installed in the environment (`ffmpeg -version` should work) |
| Video generation fails | Check logs; ensure sufficient disk space and memory |
| API errors | Verify API keys are valid and not rate-limited |
| Timeout errors | Increase request timeout limits in hosting provider |

## Security

- No API keys are sent to the client
- CORS not configured for open access (designed for same-origin)
- Setup endpoints have rate limiting and token protection
- Generated files are stored in the app directory (not exposed except via controlled endpoints)
