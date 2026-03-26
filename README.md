# FloatChat: Next-Gen AI Assistant

FloatChat is a highly advanced, multi-modal AI chatbot built with a Next.js (Turbo) frontend and a FastAPI Python NLP backend. It supports rich text, live real-time sentiment analysis, document and image vision uploads via Llama 3.2, and automatic "smart reply" generations.

## Features
- **Multi-Modal Vision System**: Upload images directly. The Python microservice automatically switches between `llama-3.1-8b` for text and `llama-3.2-11b-vision-preview` to accurately describe visual attachments.
- **Async NLP Analysis**: Performs complex embedding generation, sentiment analysis, and intent categorization concurrently in the background. Your chat streamed Time-To-First-Byte (TTFB) remains strictly at zero.
- **Smart Replies**: Uses Natural Language Processing to read the context of AI responses and suggest clickable follow-up questions for the User.
- **Universal Authentication**: Supports Google, GitHub, and SMS Phone Number verification effortlessly using Firebase UI integrated Auth limits.
- **Markdown Highlighting**: Every line of code the AI issues is beautifully formatted utilizing `react-markdown` and `rehype-highlight` against an Atom Dark theme.
- **Responsive Drawer**: 100% fluid mobile layout ensuring chat inputs are not hidden by mobile browser navigation bars (`100dvh`), with a slide-out overlay Hamburger menu for quick history access.

## Tech Stack
- **Frontend**: Next.js 14 App Router, React 19, Tailwind CSS v4, Lucide Icons.
- **Backend Service (NLP)**: FastAPI, Python 3, SentenceTransformers, HuggingFace, Groq Cloud LLM APIs.
- **Database**: Prisma ORM, SQLite (local memory state memory persistence).
- **Authentication & Storage**: Firebase v10 (Google Auth, Phone Auth, Cloud Storage Buckets).

## Running the Application

### 1. Start the Machine Learning Backend
Navigate into the Python microservice folder, activate your environment, and start the FastAPI uvicorn server:
```bash
cd nlp-service
./venv/Scripts/activate
uvicorn main:app --port 8000 --reload
```

### 2. Start the Next.js Client
In a secondary terminal window from the root directory:
```bash
npm install
npm run dev
```

Visit the running frontend application at `http://localhost:3000`.

## Vercel Deployment Note
Deploying this repository to Vercel will instantly host the Next.js application frontend. Note that because the backend ML pipeline utilizes a distinct environment and runs actively on port `:8000`, the Fast API components in `/nlp-service` must either be hosted as [Vercel Serverless Python Functions](https://vercel.com/docs/functions/serverless-functions/runtimes/python) or hosted on a separate container platform (e.g., Render or Heroku) and the routes inside `app/api/...` must be pointed away from `127.0.0.1` to match your deployed URL.

---
**Created by**: [Nilesh Rathore](https://github.com/nileshrathore22)
