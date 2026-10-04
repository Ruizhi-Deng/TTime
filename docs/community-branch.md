# TTime Community

当前分支 `reverse-0915` 基于公开的 0.9.2 源码，提供单用户本地版本。

## 第二阶段已完成

- 删除账户、登录、会员、设备绑定、云端配置和云端历史。
- 删除依赖上游服务的 TTime 翻译、TTime AI、在线 OCR 和内置小牛共享密钥。
- 删除上游自动更新、登录回调 HTTP 服务和使用事件上报。
- 保留用户自备密钥的翻译与 OCR 服务、本地离线 OCR、快捷键、截图、划词、窗口与代理设置。
- 翻译历史只保存到本机，取消原有 30 条限制。

应用名称为 **TTime Community**，使用独立应用标识与本地数据目录。首次启动生成新配置；不导入、迁移或兼容旧版配置与历史。Windows 默认数据目录为 `%APPDATA%/TTime Community/`。用户需要重新填写密钥和设置偏好。Windows 安装程序默认安装到当前用户。

初始翻译服务为 Google 内置翻译、Bing 词典和 DeepL 内置翻译，初始 OCR 为本地 TTime OCR。云端账户与同步功能没有替代实现。

## 构建和验证

Windows 使用 Node.js 16.20.2 与 Python 3.10：

```sh
npm ci --legacy-peer-deps
npm run modules-update
npm run test:local
npm run test:ai
npm run build
npx electron-builder --win nsis --config --publish never
npx electron-builder --win portable --config --publish never
```

GitHub Actions 生成 `TTime-windows-community`，包括安装程序与便携程序。`test:local` 验证历史保存、异步结果更新、超过 30 条历史以及删除后的计数。编译和打包不代替 Windows 上的快捷键、截图与本地 OCR 实测。

## 第三阶段已完成

- 同一翻译源可启用多个实例，各自配置名称、密钥和参数。请求、流式回调与历史按实例 ID 分开处理；新请求替换同一实例的旧请求。
- OpenAI 接受完整 Chat Completions URL 和任意模型 ID，可接入兼容接口。可选密钥允许接入无鉴权的本地服务。Azure 的部署 URL 包含部署名和 api-version。
- 新增 DeepSeek、Ollama、Gemini、智谱 GLM 与 DeepLX。AI 服务支持流式和非流式响应；DeepLX 使用普通 JSON 翻译接口。
- 本地提示词库支持新增、编辑、删除和实例独立选择，预置翻译、润色、总结、分析和解释代码。变量为 `{{text}}`、`{{source}}`、`{{target}}`。任务由所选提示词决定。
- 配置保存与连接验证分开。模型名不使用固定下拉列表；请填写服务端实际提供的模型 ID。

OpenAI、DeepSeek、智谱、Ollama 和 DeepLX 填写完整请求 URL，原样保留路径与查询参数。Gemini 填写 API 基础地址，程序根据模型生成调用路径。Azure 填写完整部署调用 URL，例如 `https://RESOURCE.openai.azure.com/openai/deployments/DEPLOYMENT/chat/completions?api-version=2024-10-21`。

本版本使用 Chat Completions 协议连接 OpenAI 及兼容服务。已有 AI 实例可以在设置页重新选择提示词并填写完整接口地址。Ollama 模型由用户在自己的 Ollama 服务中安装；DeepLX 连接用户提供的服务。本应用不下载 AI 模型，也不提供共享密钥。

新增验证命令：

```sh
npm run test:ai
```

测试覆盖 HTTP 请求、协议字段、流式 UTF-8 分块、SSE 与 NDJSON、API 错误、断流、多实例并发和同实例请求取消。界面测试已验证 23 项翻译源菜单、DeepSeek 配置、本地提示词编辑与调用、无密钥的兼容接口、并行结果及各实例历史记录；使用模拟接口和 IPC。未使用真实付费服务密钥进行外网调用。

## 当前翻译源：23 个

| 翻译源 | 配置内容 |
| --- | --- |
| OpenAI / OpenAI 兼容接口 | 完整接口 URL、任意模型 ID、提示词、流式开关、可选 API Key |
| Azure OpenAI | 完整部署 URL（含 api-version）、API Key、提示词、流式开关 |
| DeepSeek | 完整接口 URL、模型 ID、API Key、提示词、流式开关 |
| Ollama | 完整接口 URL、本地模型 ID、提示词、流式开关、可选密钥 |
| Gemini | API 基础地址、模型 ID、API Key、提示词、流式开关 |
| 智谱 GLM | 完整接口 URL、模型 ID、API Key、提示词、流式开关 |
| DeepLX | 完整接口 URL、可选密钥 |
| 腾讯翻译君 | SecretId、SecretKey |
| 百度翻译 | AppId、密钥 |
| 阿里云翻译 | AccessKey ID、AccessKey Secret |
| Google 翻译 | API Key |
| 有道翻译 | AppId、密钥 |
| DeepL 官方 API | API Key |
| 火山翻译 | AccessKey ID、SecretKey |
| 小牛翻译 | API Key |
| 彩云翻译 | Token |
| Papago | Client ID、Client Secret |
| Google 翻译（内置） | 无需 API 密钥 |
| DeepL 翻译（内置） | 无需 API 密钥 |
| Bing 翻译（内置） | 无需 API 密钥 |
| Bing 词典（内置） | 无需 API 密钥 |
| 腾讯交互翻译 TranSmart（内置） | 无需 API 密钥 |
| 简明英汉词典 EcDict（离线） | 无需 API 密钥，先导入离线词典 |

## 后续阶段

第四阶段：恢复 PP-OCRv4 与结构化 OCR 输出，处理模型缓存、文本框合并和英文空格。
