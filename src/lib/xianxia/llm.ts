// 修仙模拟器 - LLM 服务（barrel）
// 本文件已按职责拆分到 ./llm/ 目录，此处仅做 re-export，保持 `@/lib/xianxia/llm` 导入路径不变。
//   - ./llm/prompt-builder      —— 世界观知识加载 + 六区 Prompt 拼装 + Identity/Scene 模板 + advance/choose/interfere prompt 构建
//   - ./llm/client              —— 运行时配置 + apiKey 解析 + 短时缓存 + callLLM/callLLMText/callLLMStream
//   - ./llm/response-parser     —— parseJSON 多层兜底 + narrative 年龄清洗 + schema 校验 + 各 sanitize* 净化器
//   - ./llm/generators          —— 各 generate* 生成函数
//   - ./llm/phase-k-augmentation—— Phase-K prompt augmentation 注册表与 applier

export * from './llm/prompt-builder';
export * from './llm/client';
export * from './llm/response-parser';
export * from './llm/generators';
export * from './llm/phase-k-augmentation';
