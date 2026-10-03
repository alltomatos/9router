let _handleImageGeneration = null;
let _handleTts = null;
let _handleStt = null;

async function getMediaHandlers() {
  if (!_handleImageGeneration) {
    const mod = await import("../../sse/handlers/imageGeneration.js");
    _handleImageGeneration = mod.handleImageGeneration;
  }
  if (!_handleTts) {
    const mod = await import("../../sse/handlers/tts.js");
    _handleTts = mod.handleTts;
  }
  if (!_handleStt) {
    const mod = await import("../../sse/handlers/stt.js");
    _handleStt = mod.handleStt;
  }
  return {
    handleImageGeneration: _handleImageGeneration,
    handleTts: _handleTts,
    handleStt: _handleStt,
  };
}

export const generateImageTool = {
  name: "generate_image",
  description: "Generate images using 9Router image providers (DALL-E, Imagen, etc.)",
  inputSchema: {
    type: "object",
    properties: {
      prompt: { type: "string", description: "Prompt describing the desired image" },
      model: { type: "string", description: "Model ID (e.g. openai/dall-e-3)" },
      size: { type: "string", description: "Image dimensions (e.g. 1024x1024)" },
      n: { type: "number", description: "Number of images (default 1)" },
    },
    required: ["prompt"],
  },
};

export async function handleGenerateImage(args) {
  const { handleImageGeneration } = await getMediaHandlers();
  const req = new Request("http://localhost/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: args.prompt,
      model: args.model || args.provider,
      size: args.size,
      n: args.n || 1,
    }),
  });

  const res = await handleImageGeneration(req);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || data.error || `HTTP ${res.status}`);
  }
  return data;
}

export const textToSpeechTool = {
  name: "text_to_speech",
  description: "Convert text to speech audio using 9Router TTS providers",
  inputSchema: {
    type: "object",
    properties: {
      input: { type: "string", description: "Text content to synthesize into speech" },
      model: { type: "string", description: "Model ID (e.g. openai/tts-1)" },
      voice: { type: "string", description: "Voice identifier" },
    },
    required: ["input"],
  },
};

export async function handleTextToSpeech(args) {
  const { handleTts } = await getMediaHandlers();
  const req = new Request("http://localhost/v1/audio/speech", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: args.input,
      model: args.model || args.provider,
      voice: args.voice,
    }),
  });

  const res = await handleTts(req);
  if (!res.ok) {
    let errText = `HTTP ${res.status}`;
    try {
      const errJson = await res.json();
      errText = errJson.error?.message || errJson.error || errText;
    } catch {
      // ignore
    }
    throw new Error(errText);
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = res.headers.get("content-type") || "audio/mpeg";

  return {
    contentType,
    bytes: buffer.length,
    base64Audio: buffer.toString("base64"),
  };
}

export const speechToTextTool = {
  name: "speech_to_text",
  description: "Transcribe audio speech to text using Whisper or other speech providers",
  inputSchema: {
    type: "object",
    properties: {
      audioBase64: { type: "string", description: "Base64 encoded audio bytes" },
      model: { type: "string", description: "Model ID (e.g. openai/whisper-1)" },
      language: { type: "string", description: "Optional audio language ISO code" },
      prompt: { type: "string", description: "Optional prompt to guide transcription" },
    },
    required: ["audioBase64"],
  },
};

export async function handleSpeechToText(args) {
  const { handleStt } = await getMediaHandlers();
  const buffer = Buffer.from(args.audioBase64, "base64");
  const formData = new FormData();
  formData.append("file", new Blob([buffer], { type: "audio/mpeg" }), "audio.mp3");
  if (args.model) formData.append("model", args.model);
  if (args.language) formData.append("language", args.language);
  if (args.prompt) formData.append("prompt", args.prompt);

  const req = new Request("http://localhost/v1/audio/transcriptions", {
    method: "POST",
    body: formData,
  });

  const res = await handleStt(req);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || data.error || `HTTP ${res.status}`);
  }
  return data;
}
