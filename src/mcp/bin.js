#!/usr/bin/env node
/**
 * 9Router Native MCP Server CLI Runner (Stdio)
 */
import "./tools/index.js";
import { startStdioServer } from "./transport/stdio.js";
import { defaultEngine } from "./engine.js";

startStdioServer(defaultEngine);
