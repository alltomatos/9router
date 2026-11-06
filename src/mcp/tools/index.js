import { defaultEngine } from "../engine.js";
import { webSearchTool, handleWebSearch, webFetchTool, handleWebFetch } from "./web.js";
import {
  generateImageTool,
  handleGenerateImage,
  textToSpeechTool,
  handleTextToSpeech,
  speechToTextTool,
  handleSpeechToText,
} from "./media.js";
import {
  embeddingsTool,
  handleGetEmbeddings,
  listModelsTool,
  handleListModels,
} from "./embeddings.js";
import {
  statusTool,
  handleStatus,
  listProvidersTool,
  handleListProviders,
  listCombosTool,
  handleListCombos,
  createComboTool,
  handleCreateCombo,
  getUsageTool,
  handleGetUsage,
} from "./admin.js";

export function registerAllTools(engine = defaultEngine) {
  // Recursos & Operações
  engine.registerTool(webSearchTool, handleWebSearch);
  engine.registerTool(webFetchTool, handleWebFetch);
  engine.registerTool(generateImageTool, handleGenerateImage);
  engine.registerTool(textToSpeechTool, handleTextToSpeech);
  engine.registerTool(speechToTextTool, handleSpeechToText);
  engine.registerTool(embeddingsTool, handleGetEmbeddings);
  engine.registerTool(listModelsTool, handleListModels);

  // Administração & Telemetria
  engine.registerTool(statusTool, handleStatus);
  engine.registerTool(listProvidersTool, handleListProviders);
  engine.registerTool(listCombosTool, handleListCombos);
  engine.registerTool(createComboTool, handleCreateCombo);
  engine.registerTool(getUsageTool, handleGetUsage);
}

// Auto-register on import
registerAllTools(defaultEngine);
