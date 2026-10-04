# TTime Community 1.0.1

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
npm run prepare:ocr
npm run test:ocr
npm run build
npx electron-builder --win nsis portable --config --publish never
```

GitHub Actions 生成 `TTime-windows-community`，包括安装程序与便携程序。`test:local` 验证历史保存、异步结果更新、超过 30 条历史以及删除后的计数。编译和打包不代替 Windows 上的快捷键、截图与本地 OCR 实测。

Actions 在 Windows runner 上缓存完整依赖目录，以及 Electron、打包工具和中英 OCR 模型。安装版与便携版用同一次 electron-builder 调用生成，共用应用准备与压缩包；取消无自动更新用途的差分包。验证由 `npm run verify` 执行。普通构建自动取消同分支的过时运行，发布构建单独分组；发布直接在构建 runner 上传资源。

## 第三阶段已完成

- 同一翻译源可启用多个实例，各自配置名称、密钥和参数。请求、流式回调与历史按实例 ID 分开处理；新请求替换同一实例的旧请求。
- OpenAI 接受完整 Chat Completions URL 和任意模型 ID，可接入兼容接口。可选密钥允许接入无鉴权的本地服务。
- 新增 DeepSeek、Gemini 与智谱 GLM。AI 服务支持流式和非流式响应。
- 本地提示词库支持新增、编辑、删除和实例独立选择，预置翻译、润色、总结、分析和解释代码。变量为 `{{text}}`、`{{source}}`、`{{target}}`，括号内可有空格。任务由所选提示词决定。
- 配置保存与连接验证分开。模型名不使用固定下拉列表；请填写服务端实际提供的模型 ID。

OpenAI、DeepSeek和智谱 填写完整请求 URL，原样保留路径与查询参数。Gemini 填写 API 基础地址，程序根据模型生成调用路径。

本版本使用 Chat Completions 协议连接 OpenAI 及兼容服务。已有 AI 实例可以在设置页重新选择提示词并填写完整接口地址。本应用不下载 AI 模型，也不提供共享密钥。

四个 LLM 翻译源均提供 `Request Arguments` JSON 文本框，按实例保存。留空不添加参数；验证和翻译均使用该配置。填写的对象合并到请求体，模型、提示词与流式仍使用界面现有设置。保存及验证前校验 JSON 对象格式，其他参数按接口原样传递。

OpenAI 兼容接口、DeepSeek、智谱示例：

```json
{"temperature":0.1,"top_p":0.99,"frequency_penalty":0,"presence_penalty":0,"reasoning_effort":"low"}
```

Gemini 示例（使用原生字段格式）：

```json
{"generationConfig":{"temperature":0.1,"topP":0.99}}
```

具体可用参数取决于所选服务和模型；应用不强制参数名单或取值范围。

新增验证命令：

```sh
npm run test:ai
```

测试覆盖 HTTP 请求、协议字段、流式 UTF-8 分块、SSE、API 错误、断流、多实例并发和同实例请求取消。界面测试已验证 18 项翻译源菜单、DeepSeek 配置、本地提示词编辑与调用、无密钥的兼容接口、并行结果及各实例历史记录；使用模拟接口和 IPC。未使用真实付费服务密钥进行外网调用。

## 当前翻译源：18 个

| 翻译源 | 配置内容 |
| --- | --- |
| OpenAI / OpenAI 兼容接口 | 完整接口 URL、任意模型 ID、提示词、流式开关、可选 API Key、Request Arguments |
| DeepSeek | 完整接口 URL、模型 ID、API Key、提示词、流式开关、Request Arguments |
| Gemini | API 基础地址、模型 ID、API Key、提示词、流式开关、Request Arguments |
| 智谱 GLM | 完整接口 URL、模型 ID、API Key、提示词、流式开关、Request Arguments |
| 百度翻译 | AppId、密钥 |
| 阿里云翻译 | AccessKey ID、AccessKey Secret |
| Google 翻译 | API Key |
| 有道翻译 | AppId、密钥 |
| DeepL 官方 API | API Key |
| 火山翻译 | AccessKey ID、SecretKey |
| 小牛翻译 | API Key |
| 彩云翻译 | Token |
| Google 翻译（内置） | 无需 API 密钥 |
| DeepL 翻译（内置） | 无需 API 密钥 |
| Bing 翻译（内置） | 无需 API 密钥 |
| Bing 词典（内置） | 无需 API 密钥 |
| 腾讯交互翻译 TranSmart（内置） | 无需 API 密钥 |
| 简明英汉词典 EcDict（离线） | 无需 API 密钥，先导入离线词典 |

## 第四阶段已完成

- 删除 Azure OpenAI、Ollama、DeepLX、腾讯翻译君与 Papago 的翻译接口、入口和专用代码。腾讯云 OCR 与图片翻译仍保留。
- 用公开 PP-OCRv4 模型重写本地检测、方向分类和识别。检测采用旋转矩形、DB 置信度与 polygon unclip，识别采用透视裁剪和 CTC 解码，坐标映射回原图。
- OCR 输出 `OcrResult`：原图尺寸、语言、文本行、四角坐标、检测/识别置信度、段落及 `allText`。OCR 窗口可开关识别框，悬停框内查看文本与置信度。
- 支持中英混合、英文、日文、韩文、繁体中文、拉丁语系、阿拉伯语系、西里尔语系、天城文语系、泰米尔文、泰卢固文和卡纳达文 12 个模型组。部分语系使用 PP-OCRv3，模型版本以注册表为准。
- 中英混合识别保留模型输出的空格；对缺少空格的英文片段，按 CTC 对齐位置裁剪后使用英文识别模型处理。删除 WordsNinja 强制分词，不对变量名应用词典拆词。
- 在「翻译源设置 → 文字识别 → 本地 OCR」选择语言、准备模型及开关段落合并。合并依据行高、间距、对齐和旋转角；列表项、大间隔与明显分栏保留换行。原始文本行和坐标仍保存在结构化结果中。
- 中英模型随程序打包；其他模型首次识别或点击「准备模型」时下载。缓存位于 `%APPDATA%/TTime Community/ocr-models/`，文件路径由 SHA-256 标识，下载/复制校验后写入。相同模型同时请求只处理一次，活动模型会话复用，切换模型后释放前一组。
- 本地 OCR 的加载、图片解码和推理错误显示在现有 OCR 窗口。连续截图按请求 ID 过滤旧结果，推理按顺序使用会话，不混用不同语言的模型。

`npm run prepare:ocr` 下载固定版本的中英模型；`npm run build` 自动先执行此步骤。模型下载使用已有代理设置。构建时支持 HTTPS_PROXY / HTTP_PROXY。`ocr/models/` 是生成目录，不提交模型二进制。

`npm run test:ocr` 使用真实 ONNX 模型和固定图片，验证中英空格、变量名、四角坐标、倾斜识别、段落开关、空白图、会话复用、下载并发、离线缓存以及校验失败。界面测试验证 18 项翻译源、12 个 OCR 模型组、准备模型、合并开关和原图识别框。Windows 打包后还检查中英模型实际位于解包目录并验证 SHA-256。其他语言模型已验证下载、SHA-256、字符表与 ONNX 输出形状；尚未逐语言做真实文本准确率评测。用户已完成 Windows 交互实测并确认可用。

模型来自 [RapidAI/RapidOCR](https://github.com/RapidAI/RapidOCR) 的固定 `v3.9.2` 模型资源，URL 与 SHA-256 见 `src/common/ocr/models.json`。算法依据 [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) 与 RapidOCR 的公开检测/识别流程重写。相关 Apache 2.0 许可保留在 `ocr/`。测试图片使用 Noto Sans CJK 字体渲染，测试输入文字为项目自建样例。

## 第五阶段与交付

用户已完成 Windows 交互测试并确认无问题。1.0.0 同时修正提示词变量说明与空格处理，发布安装版、便携版及 SHA-256 校验文件。正式版本见 [GitHub Releases](https://github.com/Ruizhi-Deng/TTime/releases)。
