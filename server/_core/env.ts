export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  // 优先使用自定义网关，其次兼容 OPENAI_*，最后给出默认官方地址
  forgeApiUrl:
    process.env.BUILT_IN_FORGE_API_URL ||
    process.env.OPENAI_API_BASE ||
    "https://api.openai-hk.com/v1/chat/completions",
  // 兼容 OPENAI_API_KEY，避免未设置 BUILT_IN_FORGE_API_KEY 时报错
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY || process.env.OPENAI_API_KEY || "",
  // OpenAI 模型配置
  OPENAI_MODEL: process.env.OPENAI_MODEL || "gemini-3-pro-preview",
};
