## Question:

Look to this reverse proxy TypeScript code:
```TypeScript
import express from "express";
import { request } from "undici";
import type QuestionAnatomy from "./types/QuestionAnatomy.js";
import MetricWorks from "./server_domain/MetricWorks.js";
import MetricLifeCycle from "./server_domain/MetricLifeCycle.js";
import RequestIntent from "./server_domain/RequestIntent.js";
import LogImplementation from "./server_domain/LogImplementation.js";
import { AppDataSource } from "./database/dataSource.js";
import QuestionProcessingHelper from "./server_domain/QuestionProcessingHelper.js";
import { v4 as uuidv4 } from 'uuid';
import HistoryStats from "./database/services/HistoryStats.js";

const app = express();

app.use(express.raw({ type: "*/*" }));

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*"); // or specify your frontend domain
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");
  next();
});

const OLLAMA_URL = `http://host.docker.internal:${process.env.OLLAMA_PORT ?? "11434"}`;

app.all(/.*/, async (req: express.Request, res: express.Response) => {
  // const logWritter = new LogConsole();
  const logWritter = new LogImplementation();
  const targetUrl = `${OLLAMA_URL}${req.originalUrl}`;
  const metricLifeCycle = new MetricLifeCycle();
  let questionAnatomy: QuestionAnatomy | null = null;
  const requestIntent: RequestIntent = new RequestIntent(req);
  const requestIntentString = requestIntent.getIntent();
  const formatter = QuestionProcessingHelper.getFormatter();
  const formatterMilliseconds = QuestionProcessingHelper.getFormatterMilliseconds();
  let uuid: string;
  const timeout = 1000 * 60 * 60 * 3;

  logWritter.log(`Intent: ${requestIntentString || "unknown"}`);

  if (requestIntentString === "alooha_stats") {
    let historyStats = new HistoryStats();
    let statsData = await historyStats.getModelCounts();
    return res.status(200).json({message: statsData});
  }

  if (requestIntentString === "question") {
    questionAnatomy = MetricWorks.getAnatomy(req.body.toString(), req);
    metricLifeCycle.setWhenBegan();
    metricLifeCycle.setUserIp(req);

    logWritter.log(`I got your question:`);
    logWritter.log("=============================");
    logWritter.log(questionAnatomy.question);

    uuid = uuidv4();
    logWritter.log(`Uuid: ${uuid}`);
    if (questionAnatomy.systemPrompt) {
      logWritter.log("System prompt:");
      logWritter.log("==========");
      logWritter.log(questionAnatomy.systemPrompt);
    }
    logWritter.log(`Model choosed: ${questionAnatomy.model}`);
    logWritter.log(`Timeout: ${timeout / 1000} seconds`);
    
    const date = new Date();
    logWritter.log(`Your question got -> ${questionAnatomy.question.length} <- characters.`);
    logWritter.log(`===> ${formatter.format(date)}`);
  }

  try {
    const headers = { ...req.headers };

    delete headers.host;
    delete headers["content-length"];
    delete headers.connection;

    const upstreamAbortController = new AbortController();
    let upstreamAborted = false;

    const stopUpstream = () => {
      if (upstreamAborted) {
        return;
      }

      upstreamAborted = true;
      upstreamAbortController.abort();
    };

    req.on("aborted", stopUpstream);
    res.on("close", stopUpstream);

    const { body, statusCode, headers: upstreamHeaders } = await request(targetUrl, {
      method: req.method,
      headers,
      body: req.body && req.body.length ? req.body : undefined,
      signal: upstreamAbortController.signal,

      headersTimeout: timeout,
      bodyTimeout: timeout,
    });

    res.status(statusCode);

    QuestionProcessingHelper.assemblyHeader(res, upstreamHeaders);

    let totalBytes = 0;
    let totalChunks = 0;
    let hasStartedStreaming = false;

    body.on("data", (chunk: Buffer) => {
      totalBytes += chunk.length;
      hasStartedStreaming = true;
      if (requestIntentString === "question") {
        const chunksResponse = metricLifeCycle.digestChunk(chunk);
        if ("" !== chunksResponse) {
          totalChunks++;
          logWritter.log(`-> chunk: ${uuid}, ${formatterMilliseconds.format(new Date())} <-`);
          logWritter.log(`--->${chunksResponse}<---`);
        }
      }
    });

    body.on("error", (err) => {
      logWritter.log("OOPS! An error!");
      console.error("Stream error:", err);
      res.destroy(err);
    });

    body.pipe(res);

    let completed = false;
    const finishQuestionIfNeeded = () => {
      if (completed) {
        return;
      }

      completed = true;
      logWritter.log("===> End event reached <===");

      if (requestIntentString === "question") {
        QuestionProcessingHelper.finishQuestion(
          metricLifeCycle,
          questionAnatomy,
          totalBytes,
          totalChunks,
          logWritter
        );
      }
    };

    body.on("end", () => {
      logWritter.log("End body event emitted.");
      if (!completed) {
        finishQuestionIfNeeded();
      }
    });

    res.on("close", () => {
      if (!completed && QuestionProcessingHelper.shouldLogCancellationMessage(completed, hasStartedStreaming)) {
        logWritter.log(QuestionProcessingHelper.getRequestCancellationMessage(requestIntentString || "unknown"));
      }

      try {
        body.destroy();
      } catch (err) {
        console.error("Failed to destroy upstream body:", err);
      }

      if (!completed) {
        finishQuestionIfNeeded();
      }
    });

  } catch (err) {
    console.error("Proxy error:", err);
    res.status(502).json({ error: "Bad Gateway" });
  }
});

const portToServe: number = 11001;

app.listen(portToServe, "0.0.0.0", () => {
  AppDataSource.initialize();
  console.log(`Proxy running on :${portToServe.toString()}`);
});
```
Also, `src/server_domain/RequestIntent.ts` might be useful for your answer:
```
import express from "express";

class RequestIntent {
    private request: express.Request;

    constructor(request: express.Request) {
        this.request = request;
    }

    public getIntent(): 
        "listModels" | 
        "question" | 
        "option" | 
        "alooha_stats" |
        "" {
        if (this.request.method === "OPTIONS") {
            return "option";
        }
        if (this.request.originalUrl === "/api/tags") {
            return "listModels";
        }
        if (this.request.originalUrl === "/api/chat" || this.request.originalUrl === "/api/generate") {
            return "question";
        }
        if (this.request.originalUrl === "/alooha_api/stats") {
            return "alooha_stats";
        }
        return ""
    }

    public getQuestion(): string {
        const userBody = this.request.body;
        const bodyDecoded = JSON.parse(userBody);
        const userMessages = bodyDecoded.messages;
        return userMessages[0].content;
    }
}

export default RequestIntent;
```
When the user access `/api/tags`, the reverse proxy just relay the content to the user as it is. But I would like to change the answer.

Typically, the answer is like this:

```json
{
	"models": [
		{
			"name": "codellama:34b",
			"model": "codellama:34b",
			"modified_at": "2026-07-22T12:13:04.975640172-03:00",
			"size": 19052049085,
			"digest": "685be00e1532e01f795e04bc59c67bc292d9b1f80b5136d4fbdebe6830402132",
			"details": {
				"parent_model": "",
				"format": "gguf",
				"family": "llama",
				"families": null,
				"parameter_size": "34B",
				"quantization_level": "Q4_0",
				"context_length": 16384,
				"embedding_length": 8192
			},
			"capabilities": [
				"completion"
			]
		},
		{
			"name": "codellama:13b",
			"model": "codellama:13b",
			"modified_at": "2026-07-22T11:54:32.112949904-03:00",
			"size": 7365960935,
			"digest": "9f438cb9cd581fc025612d27f7c1a6669ff83a8bb0ed86c94fcf4c5440555697",
			"details": {
				"parent_model": "",
				"format": "gguf",
				"family": "llama",
				"families": null,
				"parameter_size": "13B",
				"quantization_level": "Q4_0",
				"context_length": 16384,
				"embedding_length": 5120
			},
			"capabilities": [
				"completion"
			]
		},
		{
			"name": "coney_/gpt-oss_claude-sonnet4.6:latest",
			"model": "coney_/gpt-oss_claude-sonnet4.6:latest",
			"modified_at": "2026-07-17T10:23:42.963156143-03:00",
			"size": 13793460370,
			"digest": "800cc044c04f0c2ea3cf50ea70846b944d08b9f7e92c81c538379a7285f446f5",
			"details": {
				"parent_model": "gpt-oss:20b",
				"format": "gguf",
				"family": "gptoss",
				"families": [
					"gptoss"
				],
				"parameter_size": "20.9B",
				"quantization_level": "MXFP4",
				"context_length": 131072,
				"embedding_length": 2880
			},
			"capabilities": [
				"completion",
				"tools",
				"thinking"
			]
		},
		{
			"name": "qwen2.5-coder:32b",
			"model": "qwen2.5-coder:32b",
			"modified_at": "2026-07-10T16:57:19.595971418-03:00",
			"size": 19851349898,
			"digest": "b92d6a0bd47ee79114298de0177bf920c05a706d12633950b3936778492bef41",
			"details": {
				"parent_model": "",
				"format": "gguf",
				"family": "qwen2",
				"families": [
					"qwen2"
				],
				"parameter_size": "32.8B",
				"quantization_level": "Q4_K_M",
				"context_length": 32768,
				"embedding_length": 5120
			},
			"capabilities": [
				"completion",
				"tools",
				"insert"
			]
		},
		{
			"name": "qwen3.6:27b",
			"model": "qwen3.6:27b",
			"modified_at": "2026-07-10T16:57:15.465239415-03:00",
			"size": 17420432739,
			"digest": "a50eda8ed977ab48a12431878896b27ffd5cef552c17af3317d9623b939a7f1e",
			"details": {
				"parent_model": "",
				"format": "gguf",
				"family": "qwen35",
				"families": [
					"qwen35"
				],
				"parameter_size": "27.8B",
				"quantization_level": "Q4_K_M",
				"context_length": 262144,
				"embedding_length": 5120
			},
			"capabilities": [
				"vision",
				"completion",
				"tools",
				"thinking"
			]
		},
		{
			"name": "deepseek-v2:16b",
			"model": "deepseek-v2:16b",
			"modified_at": "2026-07-08T15:41:45.130113642-03:00",
			"size": 8905124229,
			"digest": "7c8c332f2df7ac4d657f3514d757d969b84ac6d3fec5b0c02bc8491bd0dc5ea1",
			"details": {
				"parent_model": "",
				"format": "gguf",
				"family": "deepseek2",
				"families": [
					"deepseek2"
				],
				"parameter_size": "15.7B",
				"quantization_level": "Q4_0",
				"context_length": 163840,
				"embedding_length": 2048
			},
			"capabilities": [
				"completion"
			]
		},
		{
			"name": "starcoder:15b",
			"model": "starcoder:15b",
			"modified_at": "2026-06-21T20:39:07.713030985-03:00",
			"size": 8987608892,
			"digest": "fc59c84e00c5c2e2bca59cb46f6fade95a3aa54dde5fc0240fb623113745e66e",
			"details": {
				"parent_model": "",
				"format": "gguf",
				"family": "starcoder",
				"families": null,
				"parameter_size": "15B",
				"quantization_level": "Q4_0",
				"context_length": 8192,
				"embedding_length": 6144
			},
			"capabilities": [
				"completion"
			]
		},
		{
			"name": "devstral-small-2:24b",
			"model": "devstral-small-2:24b",
			"modified_at": "2026-06-06T14:14:23.055100932-03:00",
			"size": 15177374099,
			"digest": "24277f07f62db8f9cb68e9dfc679ea1818a7fbac47a50eff0a701d3f645b63c8",
			"details": {
				"parent_model": "",
				"format": "gguf",
				"family": "mistral3",
				"families": [
					"mistral3"
				],
				"parameter_size": "24.0B",
				"quantization_level": "Q4_K_M",
				"context_length": 393216,
				"embedding_length": 5120
			},
			"capabilities": [
				"vision",
				"completion",
				"tools"
			]
		},
		{
			"name": "gpt-oss:20b",
			"model": "gpt-oss:20b",
			"modified_at": "2026-06-06T14:14:04.36701444-03:00",
			"size": 13793441244,
			"digest": "17052f91a42e97930aa6e28a6c6c06a983e6a58dbb00434885a0cf5313e376f7",
			"details": {
				"parent_model": "",
				"format": "gguf",
				"family": "gptoss",
				"families": [
					"gptoss"
				],
				"parameter_size": "20.9B",
				"quantization_level": "MXFP4",
				"context_length": 131072,
				"embedding_length": 2880
			},
			"capabilities": [
				"completion",
				"tools",
				"thinking"
			]
		}
	]
}
```
I need to reorder the models listing, but keeping the same format. The statistics from usage models can be fetched with the following code snippet:
```
    let historyStats = new HistoryStats();
    let statsData = await historyStats.getModelCounts();
    return res.status(200).json({message: statsData});
```
That can be found in the reverse proxy itself.

Show me how to intercept the server answer data and reorder the models listing.

===

## Answer

To intercept and reorder the models listing returned by the `/api/tags` (or similar) endpoint, you'll need to:

1. **Intercept the response from Ollama's API** for the `GET /api/tags` request.
2. **Fetch usage statistics** using your `HistoryStats` class.
3. **Sort the models list** based on those stats (e.g., most used first).
4. **Return the sorted result** with the same JSON structure.

---

### ✅ Solution Overview

You already have a way to get stats (`historyStats.getModelCounts()`), so now we need to:

- Modify your reverse proxy logic to intercept `/api/tags`.
- Sort the `models` array based on usage.
- Return a new JSON response with reordered models.

---

## 🔧 Step-by-step Implementation

Assuming your proxy is handling requests using something like Node.js + Express or another framework, here’s how you can do it:

### 📌 Example in Express.js (Node.js)

```js
const express = require('express');
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Intercept /api/tags endpoint
app.get('/api/tags', async (req, res) => {
  try {
    // Step 1: Call the original Ollama API
    const ollamaResponse = await fetch('http://localhost:11434/api/tags'); // adjust URL as needed
    const originalData = await ollamaResponse.json();

    // Step 2: Get usage stats from your DB or cache
    let historyStats = new HistoryStats();
    let statsData = await historyStats.getModelCounts(); // returns { [modelName]: count }

    // Step 3: Reorder models based on usage (most used first)
    const sortedModels = originalData.models.sort((a, b) => {
      const aCount = statsData[a.name] || 0;
      const bCount = statsData[b.name] || 0;
      return bCount - aCount; // descending order
    });

    // Step 4: Return modified response with same structure
    res.json({
      models: sortedModels
    });
  } catch (error) {
    console.error("Error fetching or sorting tags:", error);
    res.status(500).json({ error: "Failed to fetch models" });
  }
});
```

---

## 🔄 Explanation of Key Parts

### 1. Fetch Original Tags
We call the original Ollama server at `http://localhost:11434/api/tags`.

> Make sure this URL matches where your local Ollama instance is running.

### 2. Get Usage Stats
```js
let statsData = await historyStats.getModelCounts();
```
This should return an object like:
```json
{
  "qwen2.5-coder:32b": 5,
  "gpt-oss:20b": 12,
  ...
}
```

> If not, ensure that `getModelCounts()` returns a mapping of model name → usage count.

### 3. Sort Models by Usage
```js
const sortedModels = originalData.models.sort((a, b) => {
  const aCount = statsData[a.name] || 0;
  const bCount = statsData[b.name] || 0;
  return bCount - aCount;
});
```

This sorts descending by usage.

### 4. Return New Response
Wrap the sorted list back into the expected structure:
```json
{
  "models": [...]
}
```

---

## 🛠 Optional Improvements

- Cache stats to avoid repeated DB calls.
- Add fallback sorting (e.g., alphabetical) if no usage data exists.
- Allow custom sort criteria via query params (`?sort=usage|alphabetical`).

---

## 🧪 Test It Out

1. Start your reverse proxy server.
2. Make a request to `http://yourproxy/api/tags`.
3. You should see the models ordered by frequency of use.

---

Let me know if you're using a different backend language or framework (e.g., Python FastAPI, Go, etc.), and I can tailor the code accordingly!