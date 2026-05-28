import { logger } from "./logger";

const URL_PATTERN = /https?:\/\/[^\s"')\]]+/g;
const JSON_PATTERN = /```json[\s\S]*?```|```[\s\S]*?```/g;
const IMG_PATTERN = /!\[.*?\]\(.*?\)/g;
const KEY_PATTERN = /(?<!\w)(sk-|0x)[a-fA-F0-9]{32,}(?!\w)/g;

export function sanitizeLLMOutput(text: string): string {
  let cleaned = text;

  const imgMatch = cleaned.match(IMG_PATTERN);
  if (imgMatch) {
    logger.warn("Sanitizer", "Removed image markdown from LLM output", { count: imgMatch.length });
    cleaned = cleaned.replace(IMG_PATTERN, "");
  }

  const jsonMatch = cleaned.match(JSON_PATTERN);
  if (jsonMatch) {
    logger.warn("Sanitizer", "Removed code block from LLM output", { count: jsonMatch.length });
    cleaned = cleaned.replace(JSON_PATTERN, "");
  }

  const keyMatch = cleaned.match(KEY_PATTERN);
  if (keyMatch) {
    logger.warn("Sanitizer", "Removed potential secrets from LLM output", { count: keyMatch.length });
    cleaned = cleaned.replace(KEY_PATTERN, "[REDACTED]");
  }

  return cleaned;
}
